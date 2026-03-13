package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.ChatUpdateEvent
import com.daniel.messenger.messaging.dto.MessageResponse
import com.daniel.messenger.messaging.dto.SendMessageRequest
import com.daniel.messenger.messaging.dto.TypingEvent
import com.daniel.messenger.messaging.dto.TypingRequest
import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.messaging.simp.user.SimpUserRegistry
import org.springframework.stereotype.Service

@Service
class ChatHandlerService(
    private val messageService: MessageService,
    private val messagingTemplate: SimpMessagingTemplate,
    private val chatParticipantRepository: ChatParticipantRepository,
    private val simpUserRegistry: SimpUserRegistry,
) {
    fun sendMessage(message: SendMessageRequest, senderId: Long) {
        val response = messageService.sendMessage(message, senderId)
        broadcastToChat(message.chatId, response)
        updateAndNotifyParticipants(message.chatId, senderId, response)
    }

    fun broadcastTyping(request: TypingRequest, username: String, userId: Long) {
        messagingTemplate.convertAndSend(
            "/topic/chat.${request.chatId}.typing",
            TypingEvent(chatId = request.chatId, username = username, isTyping = request.isTyping)
        )
    }

    private fun broadcastToChat(chatId: Long, response: MessageResponse) {
        messagingTemplate.convertAndSend("/topic/chat.$chatId", response)
    }

    private fun updateAndNotifyParticipants(chatId: Long, senderId: Long, response: MessageResponse) {
        val participants = chatParticipantRepository.findAllWithUserByChatId(chatId)
        updateUnreadCounts(participants, senderId, response, chatId)
        chatParticipantRepository.saveAll(participants)
        participants.forEach { sendChatUpdateEvent(chatId, it, response) }
    }

    private fun updateUnreadCounts(
        participants: List<ChatParticipant>,
        senderId: Long,
        response: MessageResponse,
        chatId: Long,
    ) {
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
        val chatEntity = ChatUpdateEvent(
            chatId = chatId,
            lastMessageContent = response.content,
            lastMessageCreatedAt = response.createdAt,
            unreadCount = participant.unreadCount
        )
        messagingTemplate.convertAndSendToUser(
            participant.user.username,
            "/queue/chat-updates",
            chatEntity
        )
    }
}
