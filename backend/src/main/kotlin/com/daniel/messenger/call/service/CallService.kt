package com.daniel.messenger.call.service

import com.daniel.messenger.call.dto.ActiveCall
import com.daniel.messenger.call.dto.CallEvent
import com.daniel.messenger.call.enum.CallEventType
import com.daniel.messenger.call.enum.CallStatus
import com.daniel.messenger.call.dto.InitiateCallResponse
import com.daniel.messenger.call.store.ActiveCallStore
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.messaging.service.ChatService
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
    private val chatService: ChatService,
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

    companion object {
        private const val CALL_MISSED_PREFIX = "call_missed"
        private const val CALL_REJECTED_PREFIX = "call_rejected"
        private const val CALL_ENDED_PREFIX = "call_ended"
        private const val CALL_TIMEOUT_SECONDS = 45L
    }

    @PreDestroy
    fun destroy() {
        scheduler.destroy()
    }

    private fun ActiveCall.elapsedSeconds(): Long =
        startedAt?.let { Duration.between(it, Instant.now()).seconds } ?: 0L

    private fun sendBusyToCallerAndReturn(
        callerUsername: String,
        receiverUsername: String,
        chatId: Long,
    ): InitiateCallResponse {
        callNotificationService.sendCallEvent(
            callerUsername,
            CallEvent(
                callId = "",
                type = CallEventType.BUSY,
                chatId = chatId,
                callerUsername = callerUsername,
                receiverUsername = receiverUsername,
            )
        )
        return InitiateCallResponse(callId = "")
    }

    fun initiateCall(callerId: Long, chatId: Long, video: Boolean = false): InitiateCallResponse {
        val participants = chatParticipantRepository.findAllWithUserByChatId(chatId)

        val callerParticipant = participants.first { it.user.id == callerId }
        val receiverParticipant = participants.first { it.user.id != callerId }

        val callerUsername = callerParticipant.user.username
        val receiverId = requireNotNull(receiverParticipant.user.id)
        val receiverUsername = receiverParticipant.user.username

        if (simpUserRegistry.getUser(receiverUsername) == null ||
            activeCallStore.findByUserId(receiverId) != null
        ) {
            return sendBusyToCallerAndReturn(callerUsername, receiverUsername, chatId)
        }

        if (activeCallStore.findByUserId(callerId) != null) {
            log.warn("User {} is already in a call, ignoring initiateCall", callerId)
            return InitiateCallResponse(callId = "")
        }

        val callId = UUID.randomUUID().toString()
        val call = ActiveCall(
            callId = callId,
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

        callNotificationService.sendCallEvent(
            receiverUsername,
            CallEvent(
                callId = callId,
                type = CallEventType.RINGING,
                chatId = chatId,
                callerUsername = callerUsername,
                receiverUsername = receiverUsername,
                video = video,
            )
        )

        scheduleTimeout(call)

        return InitiateCallResponse(callId = callId)
    }

    fun acceptCall(callId: String, userId: Long) {
        val call = activeCallStore.find(callId) ?: return
        if (call.receiverId != userId) return

        timeoutTasks.remove(callId)?.cancel(true)
        activeCallStore.update(call.copy(status = CallStatus.ACTIVE, startedAt = Instant.now()))

        callNotificationService.sendCallEvent(
            call.callerUsername,
            CallEvent(
                callId = callId,
                type = CallEventType.ACCEPTED,
                chatId = call.chatId,
                callerUsername = call.callerUsername,
                receiverUsername = call.receiverUsername,
            )
        )
        // Notify other tabs of the receiver so they dismiss the IncomingCallModal
        callNotificationService.sendCallEvent(
            call.receiverUsername,
            CallEvent(
                callId = callId,
                type = CallEventType.ACCEPTED,
                chatId = call.chatId,
                callerUsername = call.callerUsername,
                receiverUsername = call.receiverUsername,
            )
        )
    }

    fun rejectCall(callId: String, userId: Long) {
        val call = activeCallStore.find(callId) ?: return
        if (call.receiverId != userId) return

        timeoutTasks.remove(callId)?.cancel(true)
        activeCallStore.remove(call)

        callNotificationService.sendCallEvent(
            call.callerUsername,
            CallEvent(
                callId = callId,
                type = CallEventType.REJECTED,
                chatId = call.chatId,
                callerUsername = call.callerUsername,
                receiverUsername = call.receiverUsername,
            )
        )

        callMessageLogger.log(call.chatId, "$CALL_REJECTED_PREFIX:${call.callerUsername}")
    }

    fun endCall(callId: String, userId: Long) {
        val call = activeCallStore.find(callId) ?: return
        if (call.callerId != userId && call.receiverId != userId) return

        timeoutTasks.remove(callId)?.cancel(true)

        val duration = call.elapsedSeconds()

        activeCallStore.remove(call)

        val peerUsername = if (userId == call.callerId) call.receiverUsername else call.callerUsername
        callNotificationService.sendCallEvent(
            peerUsername,
            CallEvent(
                callId = callId,
                type = CallEventType.ENDED,
                chatId = call.chatId,
                callerUsername = call.callerUsername,
                receiverUsername = call.receiverUsername,
                durationSeconds = duration,
            )
        )

        val content = if (duration > 0) "$CALL_ENDED_PREFIX:$duration" else "$CALL_MISSED_PREFIX:${call.callerUsername}"
        callMessageLogger.log(call.chatId, content)
    }

    fun cancelCall(callId: String, userId: Long) {
        val call = activeCallStore.find(callId) ?: return
        if (call.callerId != userId) return

        timeoutTasks.remove(callId)?.cancel(true)
        activeCallStore.remove(call)

        callNotificationService.sendCallEvent(
            call.receiverUsername,
            CallEvent(
                callId = callId,
                type = CallEventType.CANCELLED,
                chatId = call.chatId,
                callerUsername = call.callerUsername,
                receiverUsername = call.receiverUsername,
            )
        )

        callMessageLogger.log(call.chatId, "$CALL_MISSED_PREFIX:${call.callerUsername}")
    }

    fun handleDisconnect(userId: Long) {
        val call = activeCallStore.findByUserId(userId) ?: return

        val peerUsername = if (userId == call.callerId) call.receiverUsername else call.callerUsername

        activeCallStore.remove(call)
        timeoutTasks.remove(call.callId)?.cancel(true)

        when (call.status) {
            CallStatus.ACTIVE -> {
                val duration = call.elapsedSeconds()
                callNotificationService.sendCallEvent(
                    peerUsername,
                    CallEvent(
                        callId = call.callId,
                        type = CallEventType.ENDED,
                        chatId = call.chatId,
                        callerUsername = call.callerUsername,
                        receiverUsername = call.receiverUsername,
                        durationSeconds = duration,
                    )
                )
                val content = if (duration > 0) "$CALL_ENDED_PREFIX:$duration" else "$CALL_MISSED_PREFIX:${call.callerUsername}"
                callMessageLogger.log(call.chatId, content)
            }

            CallStatus.RINGING -> when (userId) {
                call.callerId -> {
                    callNotificationService.sendCallEvent(
                        call.receiverUsername,
                        CallEvent(
                            callId = call.callId,
                            type = CallEventType.CANCELLED,
                            chatId = call.chatId,
                            callerUsername = call.callerUsername,
                            receiverUsername = call.receiverUsername,
                        )
                    )
                    callMessageLogger.log(call.chatId, "$CALL_MISSED_PREFIX:${call.callerUsername}")
                }
                call.receiverId -> {
                    callNotificationService.sendCallEvent(
                        call.callerUsername,
                        CallEvent(
                            callId = call.callId,
                            type = CallEventType.CANCELLED,
                            chatId = call.chatId,
                            callerUsername = call.callerUsername,
                            receiverUsername = call.receiverUsername,
                        )
                    )
                    callMessageLogger.log(call.chatId, "$CALL_MISSED_PREFIX:${call.callerUsername}")
                }
            }
        }
    }

    private fun scheduleTimeout(call: ActiveCall) {
        val future = scheduler.schedule(
            {
                val current = activeCallStore.find(call.callId)
                if (current == null || current.status != CallStatus.RINGING) return@schedule

                activeCallStore.remove(current)
                timeoutTasks.remove(call.callId)

                val timeoutEvent = CallEvent(
                    callId = call.callId,
                    type = CallEventType.CANCELLED,
                    chatId = call.chatId,
                    callerUsername = call.callerUsername,
                    receiverUsername = call.receiverUsername,
                )
                callNotificationService.sendCallEvent(call.callerUsername, timeoutEvent)
                callNotificationService.sendCallEvent(call.receiverUsername, timeoutEvent)

                callMessageLogger.log(call.chatId, "$CALL_MISSED_PREFIX:${call.callerUsername}")
            },
            Instant.now().plusSeconds(CALL_TIMEOUT_SECONDS),
        )
        timeoutTasks[call.callId] = future
    }
}
