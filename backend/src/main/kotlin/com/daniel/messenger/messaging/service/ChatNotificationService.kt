package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.ChatUpdateEvent
import com.daniel.messenger.messaging.dto.MessageResponse
import com.daniel.messenger.messaging.dto.ReadAckEvent
import com.daniel.messenger.messaging.dto.TypingEvent
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service

@Service
class ChatNotificationService(
    private val messagingTemplate: SimpMessagingTemplate,
) {
    fun broadcastChatMessage(chatId: Long, message: MessageResponse) {
        messagingTemplate.convertAndSend("/topic/chat.$chatId", message)
    }

    fun broadcastTyping(chatId: Long, event: TypingEvent) {
        messagingTemplate.convertAndSend("/topic/chat.$chatId.typing", event)
    }

    fun broadcastReadAck(chatId: Long, event: ReadAckEvent) {
        messagingTemplate.convertAndSend("/topic/chat.$chatId.read", event)
    }

    fun sendSidebarUpdate(username: String, event: ChatUpdateEvent) {
        messagingTemplate.convertAndSendToUser(username, "/queue/chat-updates", event)
    }
}
