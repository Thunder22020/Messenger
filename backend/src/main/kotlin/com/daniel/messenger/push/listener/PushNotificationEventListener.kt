package com.daniel.messenger.push.listener

import com.daniel.messenger.messaging.dto.event.MessageSentEvent
import com.daniel.messenger.messaging.enum.ChatType
import com.daniel.messenger.messaging.repository.ChatRepository
import com.daniel.messenger.push.service.PushNotificationService
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
class PushNotificationEventListener(
    private val pushNotificationService: PushNotificationService,
    private val chatRepository: ChatRepository,
) {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onMessageSent(event: MessageSentEvent) {
        if (event.response.type == "SYSTEM") return

        val chat = chatRepository.findById(event.chatId).orElse(null) ?: return
        val senderUsername = event.response.sender

        val body = when {
            !event.response.content.isNullOrBlank() -> event.response.content
            event.response.attachments.isNotEmpty() -> "📎 Sent an attachment"
            else -> return
        }

        val recipients = event.participants.filter { it.username != senderUsername }

        if (recipients.isEmpty()) return

        val (title, notificationBody) = when (chat.type) {
            ChatType.PRIVATE -> senderUsername to body
            ChatType.GROUP   -> (chat.title ?: "Group") to "$senderUsername: $body"
        }

        recipients.forEach { participant ->
            pushNotificationService.schedule(
                recipientUsername = participant.username,
                chatId = event.chatId,
                title = title,
                body = notificationBody,
            )
        }
    }
}
