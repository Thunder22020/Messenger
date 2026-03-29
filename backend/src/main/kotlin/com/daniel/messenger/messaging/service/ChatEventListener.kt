package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.event.ChatDeletedEvent
import com.daniel.messenger.messaging.dto.event.MessageDeletedEvent
import com.daniel.messenger.messaging.dto.event.MessageEditedEvent
import com.daniel.messenger.messaging.dto.event.MessageSentEvent
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
class ChatEventListener(
    private val chatNotificationService: ChatNotificationService,
    private val attachmentService: AttachmentService,
) {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onMessageSent(event: MessageSentEvent) {
        chatNotificationService.broadcastChatMessage(event.chatId, event.response)
        chatNotificationService.broadcastSidebarUpdate(event.chatId, event.participants, event.response)
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onMessageDeleted(event: MessageDeletedEvent) {
        chatNotificationService.broadcastChatMessage(event.chat.id, event.response)
        chatNotificationService.broadcastSidebarUpdate(event.participants, event.chat)
        if (event.hasAttachments) {
            attachmentService.deleteByMessageId(event.response.id)
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onMessageEdited(event: MessageEditedEvent) {
        chatNotificationService.broadcastChatMessage(event.chat.id, event.response)
        if (event.isLastMessage) {
            chatNotificationService.broadcastSidebarUpdate(event.participants, event.chat)
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onChatDeleted(event: ChatDeletedEvent) {
        attachmentService.deleteFromS3Async(event.s3Keys)
    }
}
