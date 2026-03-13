package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.EditMessageRequest
import com.daniel.messenger.messaging.dto.MessageResponse
import com.daniel.messenger.messaging.dto.PagedMessageResponse
import com.daniel.messenger.messaging.dto.ReplyPreviewDto
import com.daniel.messenger.messaging.dto.SendMessageRequest
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.exception.MessageNotFoundException
import com.daniel.messenger.messaging.exception.NotMessageOwnerException
import com.daniel.messenger.messaging.repository.MessageRepository
import com.daniel.messenger.messaging.toResponse
import com.daniel.messenger.user.service.UserService
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class MessageService(
    private val messageRepository: MessageRepository,
    private val chatService: ChatService,
    private val userService: UserService,
    private val chatNotificationService: ChatNotificationService,
) {
    @Transactional
    fun sendMessage(request: SendMessageRequest, senderId: Long): MessageResponse {
        val chat = chatService.findByIdOrThrow(request.chatId)
        chatService.isChatParticipantOrThrow(requireNotNull(chat.id), senderId)
        val sender = userService.findByIdOrThrow(senderId)
        val message = messageRepository.save(
            MessageEntity(
                sender = sender,
                content = request.content,
                chat = chat,
                replyToMessageId = request.replyToMessageId,
            )
        )
        chatService.updateChatLastMessage(chat, message)
        return message.toResponse(resolveSingleReplyPreview(message))
    }

    @Transactional
    fun editMessage(messageId: Long, request: EditMessageRequest, userId: Long): MessageResponse {
        val message = findByIdWithSenderOrThrow(messageId)
        checkSenderIsNotMessageOwner(message.sender.id, userId)
        message.content = request.content
        message.editedAt = Instant.now()
        val saved = messageRepository.save(message)
        broadcastMessageUpdate(saved)
        return saved.toResponse(resolveSingleReplyPreview(saved))
    }

    @Transactional
    fun deleteMessage(messageId: Long, userId: Long): MessageResponse {
        val message = findByIdWithSenderOrThrow(messageId)
        checkSenderIsNotMessageOwner(message.sender.id, userId)
        message.deletedAt = Instant.now()
        val saved = messageRepository.save(message)
        broadcastMessageUpdate(saved)
        chatService.handleMessageDeleted(
            deletedMessageId = requireNotNull(saved.id),
            chatId = requireNotNull(saved.chat.id),
        )
        return saved.toResponse(resolveSingleReplyPreview(saved))
    }

    private fun checkSenderIsNotMessageOwner(messageSenderId: Long?, userId: Long) {
        if (messageSenderId != userId) {
            throw NotMessageOwnerException("Not the message owner")
        }
    }

    fun getMessages(chatId: Long, userId: Long, before: Long?): PagedMessageResponse {
        chatService.isChatParticipantOrThrow(chatId, userId)
        val pageable = PageRequest.of(0, PAGE_SIZE + 1)
        val raw = if (before != null) {
            messageRepository.findByChatIdAndIdBefore(chatId, before, pageable)
        } else {
            messageRepository.findLatestByChatId(chatId, pageable)
        }
        val hasMoreOlder = raw.size > PAGE_SIZE
        val page = raw.take(PAGE_SIZE).reversed()
        val replyPreviews = resolveReplyPreviews(page)
        val messages = page.map { it.toResponse(replyPreviews[it.replyToMessageId]) }
        return PagedMessageResponse(messages, hasMoreOlder = hasMoreOlder, hasMoreNewer = false)
    }

    fun getMessagesAfter(chatId: Long, userId: Long, afterId: Long): PagedMessageResponse {
        chatService.isChatParticipantOrThrow(chatId, userId)
        val raw = messageRepository.findByChatIdAndIdAfter(chatId, afterId, PageRequest.of(0, PAGE_SIZE + 1))
        val hasMoreNewer = raw.size > PAGE_SIZE
        val page = raw.take(PAGE_SIZE)
        val replyPreviews = resolveReplyPreviews(page)
        val messages = page.map { it.toResponse(replyPreviews[it.replyToMessageId]) }
        return PagedMessageResponse(messages, hasMoreOlder = false, hasMoreNewer = hasMoreNewer)
    }

    fun getMessagesAround(chatId: Long, userId: Long, aroundId: Long): PagedMessageResponse {
        chatService.isChatParticipantOrThrow(chatId, userId)
        val halfPageable = PageRequest.of(0, HALF_PAGE_SIZE + 1)

        val beforeRaw = messageRepository.findByChatIdAndIdBefore(chatId, aroundId + 1, halfPageable)
        val hasMoreOlder = beforeRaw.size > HALF_PAGE_SIZE
        val beforeMessages = beforeRaw.take(HALF_PAGE_SIZE).reversed()

        val afterRaw = messageRepository.findByChatIdAndIdAfter(chatId, aroundId, halfPageable)
        val hasMoreNewer = afterRaw.size > HALF_PAGE_SIZE
        val afterMessages = afterRaw.take(HALF_PAGE_SIZE)

        val page = beforeMessages + afterMessages
        val replyPreviews = resolveReplyPreviews(page)
        val messages = page.map { it.toResponse(replyPreviews[it.replyToMessageId]) }
        return PagedMessageResponse(messages, hasMoreOlder = hasMoreOlder, hasMoreNewer = hasMoreNewer)
    }

    private fun findByIdWithSenderOrThrow(id: Long): MessageEntity =
        messageRepository.findByIdWithSender(id)
            ?: throw MessageNotFoundException("Message $id not found")

    private fun broadcastMessageUpdate(message: MessageEntity) {
        chatNotificationService.broadcastChatMessage(
            requireNotNull(message.chat.id),
            message.toResponse(resolveSingleReplyPreview(message))
        )
    }

    private fun resolveSingleReplyPreview(entity: MessageEntity): ReplyPreviewDto? =
        entity.replyToMessageId?.let { replyId ->
            messageRepository.findByIdWithSender(replyId)?.let { replyMsg ->
                ReplyPreviewDto(
                    messageId = replyId,
                    sender = replyMsg.sender.username,
                    content = if (replyMsg.deletedAt != null) "" else replyMsg.content.take(100),
                )
            }
        }

    private fun resolveReplyPreviews(messages: List<MessageEntity>): Map<Long, ReplyPreviewDto> {
        val ids = messages.mapNotNull { it.replyToMessageId }.distinct()
        if (ids.isEmpty()) return emptyMap()
        return messageRepository.findAllByIdInWithSender(ids).associate { m ->
            requireNotNull(m.id) to ReplyPreviewDto(
                messageId = requireNotNull(m.id),
                sender = m.sender.username,
                content = if (m.deletedAt != null) "" else m.content.take(100),
            )
        }
    }

    companion object {
        private const val PAGE_SIZE = 50
        private const val HALF_PAGE_SIZE = PAGE_SIZE / 2
    }
}
