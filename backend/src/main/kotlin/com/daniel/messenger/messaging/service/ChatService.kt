package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.ChatDTO
import com.daniel.messenger.messaging.dto.response.ChatParticipantResponse
import com.daniel.messenger.messaging.dto.event.ChatUpdateEvent
import com.daniel.messenger.messaging.dto.event.MessageDeletedEvent
import com.daniel.messenger.messaging.dto.event.MessageEditedEvent
import com.daniel.messenger.messaging.dto.response.MyChatResponse
import com.daniel.messenger.messaging.dto.response.OpenChatResponse
import com.daniel.messenger.messaging.dto.event.ReadAckEvent
import com.daniel.messenger.messaging.dto.event.snapshots.ParticipantSnapshot
import com.daniel.messenger.messaging.dto.response.MessageResponse
import com.daniel.messenger.messaging.entity.Chat
import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.entity.ChatParticipantId
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.enum.ChatType
import com.daniel.messenger.messaging.exception.CannotAddParticipantToPrivateChatException
import com.daniel.messenger.messaging.exception.CannotCreateChatWithYourselfException
import com.daniel.messenger.messaging.exception.ChatNotFoundException
import com.daniel.messenger.messaging.exception.GroupTitleIsNullException
import com.daniel.messenger.messaging.exception.NotChatParticipantException
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.messaging.repository.ChatRepository
import com.daniel.messenger.messaging.repository.MessageRepository
import com.daniel.messenger.messaging.toDto
import com.daniel.messenger.messaging.toSnapshot
import com.daniel.messenger.user.service.UserService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Service
class ChatService(
    private val chatRepository: ChatRepository,
    private val chatParticipantRepository: ChatParticipantRepository,
    private val messageRepository: MessageRepository,
    private val userService: UserService,
    private val chatNotificationService: ChatNotificationService,
    private val eventPublisher: ApplicationEventPublisher,
    private val attachmentService: AttachmentService,
) {
    @Transactional
    fun openPrivateChat(senderId: Long, receiverId: Long): OpenChatResponse {
        if (senderId == receiverId) throw CannotCreateChatWithYourselfException("User ID: $senderId")
        lockUsers(senderId, receiverId)
        val chat = createOrGetPrivateChat(senderId, receiverId)
        return OpenChatResponse(requireNotNull(chat.id))
    }

    private fun lockUsers(senderId: Long, receiverId: Long) {
        val (firstId, secondId) = listOf(senderId, receiverId).sorted()
        userService.lockById(firstId)
        userService.lockById(secondId)
    }

    private fun createOrGetPrivateChat(senderId: Long, receiverId: Long): Chat {
        val existingChatId = chatParticipantRepository.findPrivateChatIdByUserIds(listOf(senderId, receiverId))
        return if (existingChatId != null) {
            findByIdOrThrow(existingChatId)
        } else {
            createPrivateChatInternal(senderId, receiverId)
        }
    }

    private fun createPrivateChatInternal(senderId: Long, receiverId: Long): Chat {
        val chat = chatRepository.save(Chat(type = ChatType.PRIVATE))
        val sender = userService.findByIdOrThrow(senderId)
        val receiver = userService.findByIdOrThrow(receiverId)
        chatParticipantRepository.saveAll(listOf(
            ChatParticipant(id = ChatParticipantId(chat.id, sender.id), chat = chat, user = sender),
            ChatParticipant(id = ChatParticipantId(chat.id, receiver.id), chat = chat, user = receiver),
        ))
        return chat
    }

    @Transactional
    fun createGroupChat(creatorId: Long, title: String, participantIds: List<Long>): OpenChatResponse {
        if (title.isBlank()) throw GroupTitleIsNullException("Group title cannot be blank")

        val chat = chatRepository.save(Chat(type = ChatType.GROUP, title = title))
        val allParticipantIds = (participantIds + creatorId).distinct()
        val users = userService.findAllByIds(allParticipantIds)
        val participants = users.map { user ->
            ChatParticipant(id = ChatParticipantId(chat.id, user.id), chat = chat, user = user)
        }
        chatParticipantRepository.saveAll(participants)

        return OpenChatResponse(requireNotNull(chat.id))
    }

    @Transactional
    fun markAsRead(chatId: Long, userId: Long) {
        val chat = findByIdOrThrow(chatId)
        val participant = chatParticipantRepository.findByChat_IdAndUser_Id(chatId, userId)
            ?: throw NotChatParticipantException("Forbidden")

        participant.unreadCount = 0
        participant.lastReadMessageId = chat.lastMessageId

        sendSidebarUpdate(participant.toSnapshot(), chat.toDto())

        val lastReadId = chat.lastMessageId ?: return
        chatNotificationService.broadcastReadAck(
            chatId,
            ReadAckEvent(
                chatId = chatId,
                readerUsername = participant.user.username,
                lastReadMessageId = lastReadId
            ),
        )
    }

    @Transactional
    fun handleMessageDeleted(deletedMessageId: Long, chatId: Long, response: MessageResponse) {
        val chat = findByIdOrThrow(chatId)
        val newLast = messageRepository
            .findLastNonDeletedByChatId(chatId, PageRequest.of(0, 1))
            .firstOrNull()
        updateChatLastMessage(chat, newLast)
        chatParticipantRepository.bulkDecrementUnreadCounts(chatId, deletedMessageId)
        val participants = chatParticipantRepository.findAllWithUserByChatId(chatId).map { it.toSnapshot() }
        eventPublisher.publishEvent(MessageDeletedEvent(chat.toDto(), participants, response))
    }

    @Transactional
    fun handleLastMessageEdited(chatId: Long, messageId: Long, newContent: String?, response: MessageResponse) {
        val chat = findByIdOrThrow(chatId)
        if (chat.lastMessageId != messageId) return

        chat.lastMessageContent = newContent

        val participants = chatParticipantRepository
            .findAllWithUserByChatId(chatId)
            .map { it.toSnapshot() }
        eventPublisher.publishEvent(MessageEditedEvent(chat.toDto(), participants, response))
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun onMessageDeleted(event: MessageDeletedEvent) {
        broadcastSidebarUpdate(event.participants, event.chat)
        attachmentService.deleteByMessageId(event.response.id)
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onMessageEdited(event: MessageEditedEvent) {
        broadcastSidebarUpdate(event.participants, event.chat)
    }

    @Transactional(readOnly = true)
    fun getUserChats(userId: Long): List<MyChatResponse> {
        val chats = chatRepository.findMyChats(userId)

        val privateChatIds = chats
            .filter { it.getType() == ChatType.PRIVATE.name }
            .map { it.getChatId() }

        val displayNameMap = if (privateChatIds.isNotEmpty()) {
            chatRepository.findPrivateChatDisplayNames(privateChatIds, userId)
                .associate { it.getChatId() to it.getUsername() }
        } else {
            emptyMap()
        }

        return chats.map { chat ->
            val displayName = if (chat.getType() == ChatType.PRIVATE.name) {
                displayNameMap[chat.getChatId()] ?: ""
            } else {
                chat.getTitle() ?: ""
            }

            MyChatResponse(
                chatId = chat.getChatId(),
                type = ChatType.valueOf(chat.getType()),
                displayName = displayName,
                lastMessageContent = chat.getLastMessageContent(),
                lastMessageSender = chat.getLastMessageSender(),
                lastMessageCreatedAt = chat.getLastMessageCreatedAt(),
                unreadCount = chat.getUnreadCount(),
                lastReadMessageId = chat.getLastReadMessageId(),
            )
        }
    }

    @Transactional(readOnly = true)
    fun getChatParticipants(chatId: Long, userId: Long): List<ChatParticipantResponse> {
        isChatParticipantOrThrow(chatId, userId)
        return chatParticipantRepository.findAllWithUserByChatId(chatId).map {
            ChatParticipantResponse(
                id = requireNotNull(it.user.id),
                username = it.user.username,
                lastReadMessageId = it.lastReadMessageId,
            )
        }
    }

    @Transactional
    fun addParticipant(chatId: Long, requesterId: Long, userId: Long) {
        val chat = findByIdOrThrow(chatId)
        if (chat.type != ChatType.GROUP) throw CannotAddParticipantToPrivateChatException("Forbidden in private chat")
        isChatParticipantOrThrow(chatId, requesterId)
        if (chatParticipantRepository.existsByChat_IdAndUser_Id(chatId, userId)) return
        val user = userService.findByIdOrThrow(userId)
        chatParticipantRepository.save(
            ChatParticipant(id = ChatParticipantId(chatId, userId), chat = chat, user = user)
        )
    }

    @Transactional
    fun leaveChat(chatId: Long, userId: Long) {
        val participant = chatParticipantRepository.findByChat_IdAndUser_Id(chatId, userId)
            ?: throw NotChatParticipantException("Forbidden")
        chatParticipantRepository.delete(participant)
    }

    @Transactional
    fun removeParticipant(chatId: Long, requesterId: Long, userId: Long) {
        isChatParticipantOrThrow(chatId, requesterId)
        val participant = chatParticipantRepository.findByChat_IdAndUser_Id(chatId, userId)
            ?: throw NotChatParticipantException("Forbidden")
        chatParticipantRepository.delete(participant)
    }

    fun findByIdOrThrow(id: Long): Chat =
        chatRepository.findById(id).orElseThrow { ChatNotFoundException(id.toString()) }

    fun isChatParticipantOrThrow(chatId: Long, userId: Long) {
        if (!chatParticipantRepository.existsByChat_IdAndUser_Id(chatId, userId)) {
            throw NotChatParticipantException("Forbidden")
        }
    }

    internal fun updateChatLastMessage(chat: Chat, message: MessageEntity?) {
        chat.lastMessageId = message?.id
        chat.lastMessageContent = message?.content
        chat.lastMessageSender = message?.sender?.username
        chat.lastMessageCreatedAt = message?.createdAt
    }

    private fun broadcastSidebarUpdate(participants: List<ParticipantSnapshot>, chat: ChatDTO) {
        participants.forEach { sendSidebarUpdate(it, chat) }
    }

    private fun sendSidebarUpdate(participant: ParticipantSnapshot, chat: ChatDTO) {
        chatNotificationService.sendSidebarUpdate(
            participant.username,
            ChatUpdateEvent(
                chatId = requireNotNull(chat.id),
                lastMessageContent = chat.lastMessageContent,
                lastMessageSender = chat.lastMessageSender,
                lastMessageCreatedAt = chat.lastMessageCreatedAt,
                unreadCount = participant.unreadCount,
            ),
        )
    }

}
