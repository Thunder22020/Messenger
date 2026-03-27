package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.AttachmentDto
import com.daniel.messenger.messaging.dto.request.EditMessageRequest
import com.daniel.messenger.messaging.dto.response.MessageResponse
import com.daniel.messenger.messaging.dto.response.PagedMessageResponse
import com.daniel.messenger.messaging.dto.ReplyPreviewDto
import com.daniel.messenger.messaging.dto.request.SendMessageRequest
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.exception.MessageNotFoundException
import com.daniel.messenger.messaging.exception.NotMessageOwnerException
import com.daniel.messenger.messaging.repository.MessageRepository
import com.daniel.messenger.messaging.toDto
import com.daniel.messenger.messaging.toResponse
import com.daniel.messenger.user.entity.User
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
    private val attachmentService: AttachmentService,
    private val chatAccessService: ChatAccessService
) {

    @Transactional
    fun sendMessage(request: SendMessageRequest, sender: User): MessageResponse {
        val chat = chatService.findByIdOrThrow(request.chatId)
        val senderId = requireNotNull(sender.id)

        chatAccessService.isChatParticipantOrThrow(requireNotNull(chat.id), senderId)

        val message = messageRepository.save(
            MessageEntity(
                sender = userService.getReference(senderId),
                content = request.content,
                chat = chat,
                replyToMessageId = request.replyToMessageId,
            )
        )

        val attachments = attachmentService.linkToMessage(request.attachmentIds, message)

        chatService.updateChatLastMessage(chat, message, sender.username, attachments)

        return message.toResponse(
            senderUsername = sender.username,
            replyPreview = loadReplyPreview(message),
            attachments = attachments.map { it.toDto() },
        )
    }

    @Transactional
    fun editMessage(messageId: Long, request: EditMessageRequest, userId: Long): MessageResponse {
        val message = findMessageOrThrow(messageId)

        assertMessageOwner(message.sender?.id, userId)

        message.content = request.content
        message.editedAt = Instant.now()

        val response = toMessageResponse(message)

        val chatId = requireNotNull(message.chat.id)
        chatService.handleLastMessageEdited(chatId, requireNotNull(message.id), response)

        return response
    }

    @Transactional
    fun deleteMessage(messageId: Long, userId: Long): MessageResponse {
        val message = findMessageOrThrow(messageId)

        assertMessageOwner(message.sender?.id, userId)

        val hasAttachments = attachmentService.existsByMessageId(requireNotNull(message.id))

        message.content = null
        message.deletedAt = Instant.now()

        val response = toMessageResponse(message)

        val chatId = requireNotNull(message.chat.id)
        chatService.handleMessageDeleted(
            requireNotNull(message.id),
            chatId,
            response,
            hasAttachments,
        )

        return response
    }

    @Transactional(readOnly = true)
    fun getMessages(chatId: Long, userId: Long): PagedMessageResponse {
        checkAccess(chatId, userId)

        val pageable = PageRequest.of(0, PAGE_SIZE + 1)
        val fetchedMessages = messageRepository.findLatestByChatId(chatId, pageable)

        val hasMoreOlder = fetchedMessages.size > PAGE_SIZE

        val messagesPage = fetchedMessages
            .take(PAGE_SIZE)
            .reversed()

        return buildPagedResponse(
            messagesPage,
            hasMoreOlder = hasMoreOlder,
            hasMoreNewer = false
        )
    }

    @Transactional(readOnly = true)
    fun getMessagesBefore(chatId: Long, userId: Long, before: Long): PagedMessageResponse {
        checkAccess(chatId, userId)

        val pageable = PageRequest.of(0, PAGE_SIZE + 1)

        val fetchedMessages =
            messageRepository.findByChatIdAndIdBefore(chatId, before, pageable)

        val hasMoreOlder = fetchedMessages.size > PAGE_SIZE

        val messagesPage = fetchedMessages
            .take(PAGE_SIZE)
            .reversed()

        return buildPagedResponse(
            messagesPage,
            hasMoreOlder = hasMoreOlder,
            hasMoreNewer = false
        )
    }

    @Transactional(readOnly = true)
    fun getMessagesAfter(chatId: Long, userId: Long, afterId: Long): PagedMessageResponse {
        checkAccess(chatId, userId)

        val fetchedMessages = messageRepository.findByChatIdAndIdAfter(
            chatId,
            afterId,
            PageRequest.of(0, PAGE_SIZE + 1)
        )

        val hasMoreNewer = fetchedMessages.size > PAGE_SIZE

        val messagesPage = fetchedMessages.take(PAGE_SIZE)

        return buildPagedResponse(
            messagesPage,
            hasMoreOlder = false,
            hasMoreNewer = hasMoreNewer
        )
    }

    @Transactional(readOnly = true)
    fun getMessagesAround(chatId: Long, userId: Long, aroundId: Long): PagedMessageResponse {
        checkAccess(chatId, userId)

        val halfPageable = PageRequest.of(0, HALF_PAGE_SIZE + 1)

        val beforeFetched = messageRepository.findByChatIdAndIdBefore(
            chatId,
            aroundId + 1,
            halfPageable
        )

        val afterFetched = messageRepository.findByChatIdAndIdAfter(
            chatId,
            aroundId,
            halfPageable
        )

        val hasMoreOlder = beforeFetched.size > HALF_PAGE_SIZE
        val hasMoreNewer = afterFetched.size > HALF_PAGE_SIZE

        val beforeMessages = beforeFetched
            .take(HALF_PAGE_SIZE)
            .reversed()

        val afterMessages = afterFetched.take(HALF_PAGE_SIZE)

        val messagesPage = beforeMessages + afterMessages

        return buildPagedResponse(
            messagesPage,
            hasMoreOlder,
            hasMoreNewer
        )
    }

    @Transactional(readOnly = true)
    fun searchMessagesByContent(chatId: Long, userId: Long, query: String): List<MessageResponse> {
        if (query.length < 3) return emptyList()
        checkAccess(chatId, userId)
        val ids = messageRepository.findIdsByContentLike(chatId, query)
        if (ids.isEmpty()) return emptyList()
        val messages = messageRepository.findAllByIdInWithSender(ids)
            .sortedByDescending { it.createdAt }
        val attachments = loadAttachments(messages)
        return messages.map { it.toResponse(attachments = attachments[it.id] ?: emptyList()) }
    }

    private fun buildPagedResponse(
        messages: List<MessageEntity>,
        hasMoreOlder: Boolean,
        hasMoreNewer: Boolean
    ): PagedMessageResponse {
        val replyPreviews = loadReplyPreviews(messages)
        val attachments = loadAttachments(messages)

        val response = messages.map {
            it.toResponse(
                replyPreview = replyPreviews[it.replyToMessageId],
                attachments = attachments[it.id] ?: emptyList()
            )
        }

        return PagedMessageResponse(
            response,
            hasMoreOlder = hasMoreOlder,
            hasMoreNewer = hasMoreNewer
        )
    }

    private fun findMessageOrThrow(id: Long): MessageEntity =
        messageRepository.findByIdWithSender(id)
            ?: throw MessageNotFoundException("Message $id not found")

    private fun assertMessageOwner(senderId: Long?, userId: Long) {
        if (senderId != userId) {
            throw NotMessageOwnerException("Not the message owner")
        }
    }

    fun checkAccess(chatId: Long, userId: Long) {
        chatAccessService.isChatParticipantOrThrow(chatId, userId)
    }

    private fun loadReplyPreview(message: MessageEntity): ReplyPreviewDto? =
        message.replyToMessageId?.let { replyId ->
            messageRepository.findByIdWithSender(replyId)?.let { reply ->
                val attachmentType = getFirstAttachmentType(replyId)
                buildReplyPreviewDto(reply, attachmentType)
            }
        }

    private fun getFirstAttachmentType(messageId: Long) =
        attachmentService.getAttachmentsByMessageId(messageId)
            .firstOrNull()?.attachmentType?.name

    private fun loadReplyPreviews(messages: List<MessageEntity>): Map<Long, ReplyPreviewDto> {
        val replyIds = messages.mapNotNull { it.replyToMessageId }.distinct().ifEmpty { return emptyMap() }

        val replyMessages = messageRepository.findAllByIdInWithSender(replyIds)
        val attachmentsByMessageId = attachmentService.getAttachmentsGroupedByMessageId(replyIds)

        return replyMessages.associate { m ->
            val attachmentType = if (m.deletedAt == null)
                attachmentsByMessageId[m.id]?.firstOrNull()?.attachmentType?.name
            else null
            requireNotNull(m.id) to buildReplyPreviewDto(m, attachmentType)
        }
    }

    private fun buildReplyPreviewDto(message: MessageEntity, attachmentTypeName: String?): ReplyPreviewDto {
        val deleted = message.deletedAt != null
        return ReplyPreviewDto(
            messageId = requireNotNull(message.id),
            sender = message.sender?.username ?: "",
            content = if (deleted) "" else message.content?.take(100),
            attachmentType = if (deleted) null else attachmentTypeName,
        )
    }

    private fun loadAttachments(messages: List<MessageEntity>): Map<Long, List<AttachmentDto>> {
        val ids = messages.mapNotNull { it.id }.ifEmpty { return emptyMap() }

        return attachmentService.getAttachmentsGroupedByMessageId(ids)
            .mapValues { (_, list) -> list.map { it.toDto() } }
    }

    private fun toMessageResponse(message: MessageEntity): MessageResponse =
        if (message.deletedAt != null) {
            message.toResponse()
        } else {
            val attachments = attachmentService
                .getAttachmentsByMessageId(requireNotNull(message.id))
                .map { it.toDto() }
            message.toResponse(
                replyPreview = loadReplyPreview(message),
                attachments = attachments,
            )
        }

    companion object {
        private const val PAGE_SIZE = 50
        private const val HALF_PAGE_SIZE = PAGE_SIZE / 2
    }
}
