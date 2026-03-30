package com.daniel.messenger.call.service

import com.daniel.messenger.messaging.dto.event.MessageSentEvent
import com.daniel.messenger.messaging.dto.event.snapshots.ParticipantSnapshot
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.enum.MessageType
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.messaging.repository.MessageRepository
import com.daniel.messenger.messaging.service.ChatNotificationService
import com.daniel.messenger.messaging.service.ChatService
import com.daniel.messenger.messaging.toResponse
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class CallMessageLogger(
    private val chatService: ChatService,
    private val messageRepository: MessageRepository,
    private val chatParticipantRepository: ChatParticipantRepository,
    private val chatNotificationService: ChatNotificationService,
    private val eventPublisher: ApplicationEventPublisher,
) {
    @Transactional
    fun log(chatId: Long, content: String) {
        val chat = chatService.findByIdOrThrow(chatId)
        val systemMessage = messageRepository.save(
            MessageEntity(
                sender = null,
                content = content,
                chat = chat,
                type = MessageType.SYSTEM,
            )
        )
        chatService.updateChatLastMessage(chat, systemMessage)
        val participants = chatParticipantRepository.findAllWithUserByChatId(chatId)
        val viewingUserIds = chatNotificationService.getViewingUserIds(chatId, participants)
        chatParticipantRepository.bulkUpdateUnreadCountsNotInViewing(chatId, -1L, viewingUserIds)
        val snapshots = participants.map {
            ParticipantSnapshot(
                username = it.user.username,
                unreadCount = it.unreadCount + if (it.user.id in viewingUserIds) 0 else 1,
            )
        }
        eventPublisher.publishEvent(
            MessageSentEvent(chatId = chatId, response = systemMessage.toResponse(), participants = snapshots)
        )
    }
}
