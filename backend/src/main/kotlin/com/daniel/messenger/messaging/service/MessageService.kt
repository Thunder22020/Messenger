package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.EditMessageRequest
import com.daniel.messenger.messaging.dto.MessageResponse
import com.daniel.messenger.messaging.dto.PagedMessageResponse
import com.daniel.messenger.messaging.dto.SendMessageRequest
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.exception.MessageNotFoundException
import com.daniel.messenger.messaging.exception.NotMessageOwnerException
import com.daniel.messenger.messaging.repository.MessageRepository
import com.daniel.messenger.messaging.toResponse
import com.daniel.messenger.user.service.UserService
import org.springframework.data.domain.PageRequest
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class MessageService(
    private val messageRepository: MessageRepository,
    private val chatService: ChatService,
    private val userService: UserService,
    private val messagingTemplate: SimpMessagingTemplate,
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
                chat = chat)
        )

        chatService.updateChatLastMessage(chat, message)
        return message.toResponse()
    }

    @Transactional
    fun editMessage(messageId: Long, request: EditMessageRequest, userId: Long): MessageResponse {
        val message = findByIdWithSenderOrThrow(messageId)
        if (message.sender.id != userId) throw NotMessageOwnerException("Not the message owner")
        message.content = request.content
        message.editedAt = Instant.now()
        val saved = messageRepository.save(message)
        broadcastMessageUpdate(saved)
        return saved.toResponse()
    }

    @Transactional
    fun deleteMessage(messageId: Long, userId: Long): MessageResponse {
        val message = findByIdWithSenderOrThrow(messageId)
        if (message.sender.id != userId) throw NotMessageOwnerException("Not the message owner")
        message.deletedAt = Instant.now()
        val saved = messageRepository.save(message)
        broadcastMessageUpdate(saved)
        chatService.handleMessageDeleted(
            deletedMessageId = requireNotNull(saved.id),
            chatId = requireNotNull(saved.chat.id),
        )
        return saved.toResponse()
    }

    fun findAllByChatIdInAscOrder(chatId: Long) =
        messageRepository.findAllByChat_IdOrderByIdAsc(chatId)

    fun getMessages(chatId: Long, userId: Long, before: Long?): PagedMessageResponse {
        chatService.isChatParticipantOrThrow(chatId, userId)
        val pageable = PageRequest.of(0, PAGE_SIZE + 1)
        val raw = if (before != null) {
            messageRepository.findByChatIdAndIdBefore(chatId, before, pageable)
        } else {
            messageRepository.findLatestByChatId(chatId, pageable)
        }
        val hasMoreOlder = raw.size > PAGE_SIZE
        val messages = raw.take(PAGE_SIZE).reversed().map { it.toResponse() }
        return PagedMessageResponse(messages, hasMoreOlder = hasMoreOlder, hasMoreNewer = false)
    }

    fun getMessagesAfter(chatId: Long, userId: Long, afterId: Long): PagedMessageResponse {
        chatService.isChatParticipantOrThrow(chatId, userId)
        val pageable = PageRequest.of(0, PAGE_SIZE + 1)
        val raw = messageRepository.findByChatIdAndIdAfter(chatId, afterId, pageable)
        val hasMoreNewer = raw.size > PAGE_SIZE
        val messages = raw.take(PAGE_SIZE).map { it.toResponse() }
        return PagedMessageResponse(messages, hasMoreOlder = false, hasMoreNewer = hasMoreNewer)
    }

    fun getMessagesAround(chatId: Long, userId: Long, aroundId: Long): PagedMessageResponse {
        chatService.isChatParticipantOrThrow(chatId, userId)
        val halfPage = PageRequest.of(0, HALF_PAGE_SIZE + 1)

        // Messages at or before aroundId (context: the last-read message and older)
        val beforeRaw = messageRepository.findByChatIdAndIdBefore(chatId, aroundId + 1, halfPage)
        val hasMoreOlder = beforeRaw.size > HALF_PAGE_SIZE
        val beforeMessages = beforeRaw.take(HALF_PAGE_SIZE).reversed()

        // Messages after aroundId (the unread block)
        val afterRaw = messageRepository.findByChatIdAndIdAfter(chatId, aroundId, halfPage)
        val hasMoreNewer = afterRaw.size > HALF_PAGE_SIZE
        val afterMessages = afterRaw.take(HALF_PAGE_SIZE)

        val messages = (beforeMessages + afterMessages).map { it.toResponse() }
        return PagedMessageResponse(messages, hasMoreOlder = hasMoreOlder, hasMoreNewer = hasMoreNewer)
    }

    private fun findByIdWithSenderOrThrow(id: Long): MessageEntity =
        messageRepository.findByIdWithSender(id) ?: throw MessageNotFoundException("Message $id not found")

    private fun broadcastMessageUpdate(message: MessageEntity) {
        messagingTemplate.convertAndSend("/topic/chat.${message.chat.id}", message.toResponse())
    }

    companion object {
        private const val PAGE_SIZE = 50
        private const val HALF_PAGE_SIZE = PAGE_SIZE / 2
    }
}
