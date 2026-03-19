package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.event.ChatUpdateEvent
import com.daniel.messenger.messaging.dto.event.MessageSentEvent
import com.daniel.messenger.messaging.dto.event.ParticipantSnapshot
import com.daniel.messenger.messaging.dto.request.SendMessageRequest
import com.daniel.messenger.messaging.dto.event.TypingEvent
import com.daniel.messenger.messaging.dto.request.TypingRequest
import com.daniel.messenger.messaging.dto.response.MessageResponse
import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.user.entity.User
import org.springframework.context.ApplicationEventPublisher
import org.springframework.messaging.simp.user.SimpUserRegistry
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Service
class ChatHandlerService(
    private val messageService: MessageService,
    private val chatNotificationService: ChatNotificationService,
    private val chatParticipantRepository: ChatParticipantRepository,
    private val simpUserRegistry: SimpUserRegistry,
    private val eventPublisher: ApplicationEventPublisher,
) {
    @Transactional
    fun sendMessage(message: SendMessageRequest, sender: User) {
        val response = messageService.sendMessage(message, sender)
        val participants = chatParticipantRepository.findAllWithUserByChatId(message.chatId)

        val senderId = requireNotNull(sender.id)
        val viewingUserIds = getViewingUserIds(participants, message.chatId)
        chatParticipantRepository.bulkUpdateUnreadCountsNotInViewing(message.chatId, senderId, viewingUserIds)

        val snapshots = convertToParticipantSnapshots(participants, senderId, viewingUserIds)
        eventPublisher.publishEvent(MessageSentEvent(message.chatId, response, snapshots))
    }

    private fun getViewingUserIds(participants: List<ChatParticipant>, chatId: Long) =
        participants
            .filter { isUserViewingChat(it.user.username, chatId) }
            .mapNotNull { it.user.id }

    private fun isUserViewingChat(username: String, chatId: Long): Boolean =
        simpUserRegistry.getUser(username)
            ?.sessions
            ?.any { session -> session.subscriptions.any { it.destination == "/topic/chat.$chatId" } }
            ?: false

    private fun convertToParticipantSnapshots(
        participants: List<ChatParticipant>,
        senderId: Long,
        viewingUserIds: List<Long>,
    ): List<ParticipantSnapshot> =
        participants.map { p ->
            val incremented = p.user.id != senderId && p.user.id !in viewingUserIds
            ParticipantSnapshot(
                username = p.user.username,
                unreadCount = p.unreadCount + if (incremented) 1 else 0,
            )
        }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    private fun onMessageSent(event: MessageSentEvent) {
        chatNotificationService.broadcastChatMessage(event.chatId, event.response)
        event.participants.forEach {
            sendSidebarChatsUpdateEvent(event.chatId, it, event.response)
        }
    }

    private fun sendSidebarChatsUpdateEvent(chatId: Long, participant: ParticipantSnapshot, response: MessageResponse) {
        chatNotificationService.sendSidebarUpdate(
            participant.username,
            ChatUpdateEvent(
                chatId = chatId,
                lastMessageContent = response.content,
                lastMessageCreatedAt = response.createdAt,
                unreadCount = participant.unreadCount,
            ),
        )
    }

    fun broadcastTyping(request: TypingRequest, username: String) {
        chatNotificationService.broadcastTyping(
            request.chatId,
            TypingEvent(
                chatId = request.chatId,
                username = username,
                isTyping = request.isTyping
            ),
        )
    }
}
