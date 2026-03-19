package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.event.ChatUpdateEvent
import com.daniel.messenger.messaging.dto.response.MessageResponse
import com.daniel.messenger.messaging.dto.request.SendMessageRequest
import com.daniel.messenger.messaging.dto.event.TypingEvent
import com.daniel.messenger.messaging.dto.request.TypingRequest
import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.user.entity.User
import org.springframework.messaging.simp.user.SimpUserRegistry
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ChatHandlerService(
    private val messageService: MessageService,
    private val chatNotificationService: ChatNotificationService,
    private val chatParticipantRepository: ChatParticipantRepository,
    private val simpUserRegistry: SimpUserRegistry,
) {
    @Transactional
    fun sendMessage(message: SendMessageRequest, sender: User) {
        val response = messageService.sendMessage(message, sender)
        chatNotificationService.broadcastChatMessage(message.chatId, response)
        updateAndNotifyParticipants(message.chatId, requireNotNull(sender.id), response)
    }

    private fun updateAndNotifyParticipants(chatId: Long, senderId: Long, response: MessageResponse) {
        val participants = chatParticipantRepository.findAllWithUserByChatId(chatId)
        updateUnreadCounts(participants, senderId, chatId)
        chatParticipantRepository.saveAll(participants)
        participants.forEach {
            sendChatUpdateEvent(chatId, it, response)
        }
    }

    private fun updateUnreadCounts(participants: List<ChatParticipant>, senderId: Long, chatId: Long) {
        participants.forEach { participant ->
            if (participant.user.id == senderId) return@forEach
            if (isUserViewingChat(participant.user.username, chatId)) {
                participant.unreadCount = 0
            } else {
                participant.unreadCount += 1
            }
        }
    }

    private fun isUserViewingChat(username: String, chatId: Long): Boolean =
        simpUserRegistry.getUser(username)
            ?.sessions
            ?.any { session -> session.subscriptions.any { it.destination == "/topic/chat.$chatId" } }
            ?: false

    private fun sendChatUpdateEvent(chatId: Long, participant: ChatParticipant, response: MessageResponse) {
        chatNotificationService.sendSidebarUpdate(
            participant.user.username,
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
