package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.event.MessageSentEvent
import com.daniel.messenger.messaging.dto.request.SendMessageRequest
import com.daniel.messenger.messaging.dto.event.TypingEvent
import com.daniel.messenger.messaging.dto.event.snapshots.ParticipantSnapshot
import com.daniel.messenger.messaging.dto.request.TypingRequest
import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.user.entity.User
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ChatHandlerService(
    private val messageService: MessageService,
    private val chatNotificationService: ChatNotificationService,
    private val chatAccessService: ChatAccessService,
    private val chatParticipantRepository: ChatParticipantRepository,
    private val eventPublisher: ApplicationEventPublisher,
) {
    @Transactional
    fun sendMessage(message: SendMessageRequest, sender: User) {
        val response = messageService.sendMessage(message, sender)
        val participants = chatParticipantRepository.findAllWithUserByChatId(message.chatId)

        val senderId = requireNotNull(sender.id)
        val viewingUserIds = chatNotificationService.getViewingUserIds(message.chatId, participants)
        chatParticipantRepository.bulkUpdateUnreadCountsNotInViewing(message.chatId, senderId, viewingUserIds)

        val snapshots = convertToParticipantSnapshots(participants, senderId, viewingUserIds)
        eventPublisher.publishEvent(MessageSentEvent(message.chatId, response, snapshots))
    }

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

    fun broadcastTyping(request: TypingRequest, user: User) {
        chatAccessService.isChatParticipantOrThrow(request.chatId, requireNotNull(user.id))
        chatNotificationService.broadcastTyping(
            request.chatId,
            TypingEvent(
                chatId = request.chatId,
                username = user.username,
                isTyping = request.isTyping,
            ),
        )
    }
}
