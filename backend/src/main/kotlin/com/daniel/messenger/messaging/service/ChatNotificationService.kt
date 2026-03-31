package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.ChatDTO
import com.daniel.messenger.messaging.dto.event.ChatUpdateEvent
import com.daniel.messenger.messaging.dto.event.ChatUpdateType
import com.daniel.messenger.messaging.dto.response.MessageResponse
import com.daniel.messenger.messaging.dto.event.ReadAckEvent
import com.daniel.messenger.messaging.dto.event.TypingEvent
import com.daniel.messenger.messaging.dto.event.snapshots.ParticipantSnapshot
import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.resolveContentPreview
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.messaging.simp.user.SimpUserRegistry
import org.springframework.stereotype.Service

@Service
class ChatNotificationService(
    private val messagingTemplate: SimpMessagingTemplate,
    private val simpUserRegistry: SimpUserRegistry,
) {
    fun getViewingUserIds(chatId: Long, participants: List<ChatParticipant>): List<Long> =
        participants
            .filter { isUserViewingChat(it.user.username, chatId) }
            .mapNotNull { it.user.id }

    private fun isUserViewingChat(username: String, chatId: Long): Boolean =
        simpUserRegistry.getUser(username)
            ?.sessions
            ?.any { session -> session.subscriptions.any { it.destination == "/topic/chat.$chatId" } }
            ?: false

    fun broadcastChatMessage(chatId: Long, message: MessageResponse) {
        messagingTemplate.convertAndSend("/topic/chat.$chatId", message)
    }

    fun broadcastTyping(chatId: Long, event: TypingEvent) {
        messagingTemplate.convertAndSend("/topic/chat.$chatId.typing", event)
    }

    fun broadcastReadAck(chatId: Long, event: ReadAckEvent) {
        messagingTemplate.convertAndSend("/topic/chat.$chatId.read", event)
    }

    fun broadcastSidebarUpdate(chatId: Long, participants: List<ParticipantSnapshot>, response: MessageResponse) {
        participants.forEach { participant ->
            sendSidebarUpdate(
                participant.username,
                ChatUpdateEvent(
                    chatId = chatId,
                    type = ChatUpdateType.CONTENT,
                    lastMessageContent = resolveContentPreview(response),
                    lastMessageSender = response.sender,
                    lastMessageCreatedAt = response.createdAt,
                    unreadCount = participant.unreadCount,
                ),
            )
        }
    }

    fun broadcastSidebarUpdate(participants: List<ParticipantSnapshot>, chat: ChatDTO) {
        participants.forEach { participant ->
            sendSidebarUpdate(
                participant.username,
                ChatUpdateEvent(
                    chatId = chat.id,
                    type = ChatUpdateType.CONTENT,
                    lastMessageContent = chat.lastMessageContent,
                    lastMessageSender = chat.lastMessageSender,
                    lastMessageCreatedAt = chat.lastMessageCreatedAt,
                    unreadCount = participant.unreadCount,
                ),
            )
        }
    }

    fun sendSidebarUpdate(username: String, event: ChatUpdateEvent) {
        messagingTemplate.convertAndSendToUser(username, "/queue/chat-updates", event)
    }

    fun sendChatDeleted(username: String, chatId: Long) {
        sendSidebarUpdate(username, ChatUpdateEvent(chatId = chatId, type = ChatUpdateType.DELETED, unreadCount = 0))
    }
}
