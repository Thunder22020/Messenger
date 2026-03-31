package com.daniel.messenger.call.service

import com.daniel.messenger.call.dto.ActiveCall
import com.daniel.messenger.call.dto.CallEvent
import com.daniel.messenger.call.enum.CallEventType
import com.daniel.messenger.call.enum.CallStatus
import com.daniel.messenger.call.dto.InitiateCallResponse
import com.daniel.messenger.call.store.ActiveCallStore
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import jakarta.annotation.PreDestroy
import org.slf4j.LoggerFactory
import org.springframework.messaging.simp.user.SimpUserRegistry
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ScheduledFuture

@Service
class CallService(
    private val activeCallStore: ActiveCallStore,
    private val callNotificationService: CallNotificationService,
    private val chatParticipantRepository: ChatParticipantRepository,
    private val callMessageLogger: CallMessageLogger,
    private val simpUserRegistry: SimpUserRegistry,
) {
    private val log = LoggerFactory.getLogger(CallService::class.java)

    private val scheduler = ThreadPoolTaskScheduler().apply {
        poolSize = 2
        setThreadNamePrefix("call-timeout-")
        initialize()
    }

    private val timeoutTasks = ConcurrentHashMap<String, ScheduledFuture<*>>()

    @PreDestroy
    fun destroy() {
        scheduler.destroy()
    }

    fun initiateCall(callerId: Long, chatId: Long, video: Boolean = false): InitiateCallResponse {
        val participants = chatParticipantRepository.findAllWithUserByChatId(chatId)

        val callerParticipant = participants.first { it.user.id == callerId }
        val receiverParticipant = participants.first { it.user.id != callerId }

        val callerUsername = callerParticipant.user.username
        val receiverId = requireNotNull(receiverParticipant.user.id)
        val receiverUsername = receiverParticipant.user.username

        val receiverOfflineOrBusy = simpUserRegistry.getUser(receiverUsername) == null
                || activeCallStore.findByUserId(receiverId) != null
        if (receiverOfflineOrBusy) {
            notifyCaller(callerUsername, CallEvent(
                callId = "",
                type = CallEventType.BUSY,
                chatId = chatId,
                callerUsername = callerUsername,
                receiverUsername = receiverUsername,
            ))
            return InitiateCallResponse(callId = "")
        }

        if (activeCallStore.findByUserId(callerId) != null) {
            log.warn("User {} is already in a call, ignoring initiateCall", callerId)
            return InitiateCallResponse(callId = "")
        }

        val call = ActiveCall(
            callId = UUID.randomUUID().toString(),
            chatId = chatId,
            callerId = callerId,
            callerUsername = callerUsername,
            receiverId = receiverId,
            receiverUsername = receiverUsername,
            status = CallStatus.RINGING,
            startedAt = null,
            initiatedAt = Instant.now(),
            video = video,
        )
        activeCallStore.save(call)
        callNotificationService.sendCallEvent(receiverUsername, call.toEvent(CallEventType.RINGING, video = video))
        scheduleTimeout(call)

        return InitiateCallResponse(callId = call.callId)
    }

    fun acceptCall(callId: String, userId: Long) {
        val call = findCallForParticipant(callId, expectedRole = Role.RECEIVER, userId) ?: return

        cancelTimeout(callId)
        activeCallStore.update(call.copy(status = CallStatus.ACTIVE, startedAt = Instant.now()))

        val acceptedEvent = call.toEvent(CallEventType.ACCEPTED)
        callNotificationService.sendCallEvent(call.callerUsername, acceptedEvent)
        callNotificationService.sendCallEvent(call.receiverUsername, acceptedEvent)
    }

    fun rejectCall(callId: String, userId: Long) {
        val call = findCallForParticipant(callId, expectedRole = Role.RECEIVER, userId) ?: return
        terminateCall(call, call.callerUsername, CallEventType.REJECTED, "$CALL_REJECTED_PREFIX:${call.callerUsername}")
    }

    fun endCall(callId: String, userId: Long) {
        val call = activeCallStore.find(callId) ?: return
        if (call.callerId != userId && call.receiverId != userId) return

        val peerUsername = call.peerOf(userId)
        val duration = call.elapsedSeconds()
        val logContent = endedLogContent(call.callerUsername, duration)
        terminateCall(call, peerUsername, CallEventType.ENDED, logContent, duration)
    }

    fun cancelCall(callId: String, userId: Long) {
        val call = findCallForParticipant(callId, expectedRole = Role.CALLER, userId) ?: return
        terminateCall(call, call.receiverUsername, CallEventType.CANCELLED, "$CALL_MISSED_PREFIX:${call.callerUsername}")
    }

    fun handleDisconnect(userId: Long) {
        val call = activeCallStore.findByUserId(userId) ?: return
        val peerUsername = call.peerOf(userId)

        when (call.status) {
            CallStatus.ACTIVE -> {
                val duration = call.elapsedSeconds()
                terminateCall(call, peerUsername, CallEventType.ENDED, endedLogContent(call.callerUsername, duration), duration)
            }
            CallStatus.RINGING -> {
                terminateCall(call, peerUsername, CallEventType.CANCELLED, "$CALL_MISSED_PREFIX:${call.callerUsername}")
            }
        }
    }

    private fun terminateCall(
        call: ActiveCall,
        notifyUsername: String,
        eventType: CallEventType,
        logContent: String,
        durationSeconds: Long? = null,
    ) {
        cancelTimeout(call.callId)
        activeCallStore.remove(call)
        callNotificationService.sendCallEvent(notifyUsername, call.toEvent(eventType, durationSeconds))
        callMessageLogger.log(call.chatId, logContent)
    }

    private fun cancelTimeout(callId: String) {
        timeoutTasks.remove(callId)?.cancel(true)
    }

    private fun notifyCaller(callerUsername: String, event: CallEvent) {
        callNotificationService.sendCallEvent(callerUsername, event)
    }

    private fun scheduleTimeout(call: ActiveCall) {
        val future = scheduler.schedule(
            { onTimeout(call.callId) },
            Instant.now().plusSeconds(CALL_TIMEOUT_SECONDS),
        )
        timeoutTasks[call.callId] = future
    }

    private fun onTimeout(callId: String) {
        val call = activeCallStore.find(callId) ?: return
        if (call.status != CallStatus.RINGING) return

        activeCallStore.remove(call)
        timeoutTasks.remove(callId)

        val timeoutEvent = call.toEvent(CallEventType.CANCELLED)
        callNotificationService.sendCallEvent(call.callerUsername, timeoutEvent)
        callNotificationService.sendCallEvent(call.receiverUsername, timeoutEvent)

        callMessageLogger.log(call.chatId, "$CALL_MISSED_PREFIX:${call.callerUsername}")
    }

    private fun findCallForParticipant(callId: String, expectedRole: Role, userId: Long): ActiveCall? {
        val call = activeCallStore.find(callId) ?: return null
        val matches = when (expectedRole) {
            Role.CALLER -> call.callerId == userId
            Role.RECEIVER -> call.receiverId == userId
        }
        return if (matches) call else null
    }

    private enum class Role { CALLER, RECEIVER }

    private fun ActiveCall.elapsedSeconds(): Long =
        startedAt?.let { Duration.between(it, Instant.now()).seconds } ?: 0L

    private fun ActiveCall.peerOf(userId: Long): String =
        if (userId == callerId) receiverUsername else callerUsername

    private fun ActiveCall.toEvent(
        type: CallEventType,
        durationSeconds: Long? = null,
        video: Boolean = false,
    ): CallEvent = CallEvent(
        callId = callId,
        type = type,
        chatId = chatId,
        callerUsername = callerUsername,
        receiverUsername = receiverUsername,
        durationSeconds = durationSeconds,
        video = video,
    )

    private fun endedLogContent(callerUsername: String, duration: Long): String =
        if (duration > 0) "$CALL_ENDED_PREFIX:$duration" else "$CALL_MISSED_PREFIX:$callerUsername"

    companion object {
        private const val CALL_MISSED_PREFIX = "call_missed"
        private const val CALL_REJECTED_PREFIX = "call_rejected"
        private const val CALL_ENDED_PREFIX = "call_ended"
        private const val CALL_TIMEOUT_SECONDS = 45L
    }
}
