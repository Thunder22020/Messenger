package com.daniel.messenger.push.listener

import com.daniel.messenger.messaging.dto.event.MessageSentEvent
import com.daniel.messenger.messaging.enum.ChatType
import com.daniel.messenger.messaging.repository.ChatRepository
import com.daniel.messenger.push.service.PushNotificationService
import org.slf4j.LoggerFactory
import org.springframework.messaging.simp.user.SimpUserRegistry
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
class PushNotificationEventListener(
    private val pushNotificationService: PushNotificationService,
    private val chatRepository: ChatRepository,
    private val simpUserRegistry: SimpUserRegistry,
) {
    private val log = LoggerFactory.getLogger(javaClass)

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

        val offlineRecipients = event.participants
            .filter { it.username != senderUsername }
            .filter { simpUserRegistry.getUser(it.username) == null }

        if (offlineRecipients.isEmpty()) return

        val (title, notificationBody) = when (chat.type) {
            ChatType.PRIVATE -> senderUsername to body
            ChatType.GROUP   -> (chat.title ?: "Group") to "$senderUsername: $body"
        }

        offlineRecipients.forEach { participant ->
            pushNotificationService.schedule(
                recipientUsername = participant.username,
                chatId = event.chatId,
                title = title,
                body = notificationBody,
            )
        }
    }
}
