package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.ChatParticipantResponse
import com.daniel.messenger.messaging.dto.ChatUpdateEvent
import com.daniel.messenger.messaging.dto.MyChatResponse
import com.daniel.messenger.messaging.dto.OpenChatResponse
import com.daniel.messenger.messaging.dto.ReadAckEvent
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
import com.daniel.messenger.user.service.UserService
import org.springframework.data.domain.PageRequest
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class ChatService(
    private val chatRepository: ChatRepository,
    private val chatParticipantRepository: ChatParticipantRepository,
    private val messageRepository: MessageRepository,
    private val userService: UserService,
    private val messagingTemplate: SimpMessagingTemplate,
) {

    @Transactional
    fun openPrivateChat(senderId: Long, receiverId: Long): OpenChatResponse {
        validatePrivateChat(senderId, receiverId)
        lockUsers(senderId, receiverId)
        val chat = createOrGetPrivateChat(senderId, receiverId)
        return OpenChatResponse(requireNotNull(chat.id))
    }

    private fun validatePrivateChat(senderId: Long, receiverId: Long) {
        if (senderId == receiverId) {
            throw CannotCreateChatWithYourselfException("User ID: $senderId")
        }
    }

    private fun lockUsers(senderId: Long, receiverId: Long) {
        val (firstId, secondId) = listOf(senderId, receiverId).sorted()
        userService.lockById(firstId)
        userService.lockById(secondId)
    }

    private fun createOrGetPrivateChat(senderId: Long, receiverId: Long): Chat {
        val existingChatId = chatParticipantRepository
            .findPrivateChatIdByUserIds(listOf(senderId, receiverId))
        return if (existingChatId != null) {
            findByIdOrThrow(existingChatId)
        } else {
            createPrivateChatInternal(senderId, receiverId)
        }
    }

    @Transactional
    fun markAsRead(chatId: Long, userId: Long) {
        val chat = findByIdOrThrow(chatId)
        val participant = chatParticipantRepository.findByChat_IdAndUser_Id(chatId, userId)
            ?: throw NotChatParticipantException("Forbidden")

        resetUnreadCount(participant, chat.lastMessageId)

        messagingTemplate.convertAndSendToUser(
            participant.user.username,
            "/queue/chat-updates",
            ChatUpdateEvent(
                chatId = chatId,
                lastMessageContent = chat.lastMessageContent ?: "",
                lastMessageCreatedAt = chat.lastMessageCreatedAt ?: Instant.now(),
                unreadCount = 0
            )
        )

        val lastReadId = chat.lastMessageId ?: return
        messagingTemplate.convertAndSend(
            "/topic/chat.$chatId.read",
            ReadAckEvent(
                chatId = chatId,
                readerUsername = participant.user.username,
                lastReadMessageId = lastReadId,
            )
        )
    }

    fun findByIdOrThrow(id: Long): Chat =
        chatRepository.findById(id).orElseThrow {
            ChatNotFoundException(id.toString())
        }

    private fun resetUnreadCount(participant: ChatParticipant, lastMessageId: Long?) {
        participant.unreadCount = 0
        participant.lastReadMessageId = lastMessageId
    }

    private fun createPrivateChatInternal(senderId: Long, receiverId: Long): Chat {
        val chat = chatRepository.save(Chat(type = ChatType.PRIVATE))
        val sender = userService.findByIdOrThrow(senderId)
        val receiver = userService.findByIdOrThrow(receiverId)
        chatParticipantRepository.saveAll(listOf(
            ChatParticipant(
                id = ChatParticipantId(chat.id, sender.id),
                chat = chat,
                user = sender
            ),
            ChatParticipant(
                id = ChatParticipantId(chat.id, receiver.id),
                chat = chat,
                user = receiver
            ),
        ))
        return chat
    }

    fun isChatParticipantOrThrow(chatId: Long, userId: Long) {
        if (!chatParticipantRepository.existsByChat_IdAndUser_Id(chatId, userId)) {
            throw NotChatParticipantException("Forbidden")
        }
    }

    fun getUserChats(userId: Long) =
        chatRepository.findAllUserChatsWithParticipants(userId)
            .map { chat ->
                val myParticipant = chat.participants.first { it.user.id == userId }
                MyChatResponse(
                    chatId = requireNotNull(chat.id),
                    type = chat.type,
                    displayName = getDisplayName(chat, userId),
                    lastMessageContent = chat.lastMessageContent,
                    lastMessageCreatedAt = chat.lastMessageCreatedAt,
                    unreadCount = myParticipant.unreadCount,
                    lastReadMessageId = myParticipant.lastReadMessageId,
                )
            }

    fun getDisplayName(chat: Chat, userId: Long): String = when (chat.type) {
        ChatType.PRIVATE -> chat.participants.first { it.user.id != userId }.user.username
        ChatType.GROUP -> requireNotNull(chat.title)
    }

    fun updateChatLastMessage(chat: Chat, message: MessageEntity) {
        chat.lastMessageId = message.id
        chat.lastMessageContent = message.content
        chat.lastMessageCreatedAt = message.createdAt
        chatRepository.save(chat)
    }

    @Transactional
    fun createGroupChat(
        creatorId: Long,
        title: String,
        participantIds: List<Long>
    ): OpenChatResponse {
        validateTitle(title)

        val chat = chatRepository.save(
            Chat(
                type = ChatType.GROUP,
                title = title
            )
        )

        val participants = (participantIds + creatorId).distinct()

        participants.forEach { userId ->
            val user = userService.findByIdOrThrow(userId)
            chatParticipantRepository.save(
                ChatParticipant(
                    id = ChatParticipantId(chat.id, user.id),
                    chat = chat,
                    user = user
                )
            )
        }

        return OpenChatResponse(requireNotNull(chat.id))
    }

    private fun validateTitle(title: String) {
        if (title.isBlank()) {
            throw GroupTitleIsNullException("Group title cannot be blank")
        }
    }

    fun getChatParticipants(chatId: Long, userId: Long): List<ChatParticipantResponse> {
        isChatParticipantOrThrow(chatId, userId)
        return chatParticipantRepository.findAllWithUserByChatId(chatId)
            .map {
                ChatParticipantResponse(
                    id = requireNotNull(it.user.id),
                    username = it.user.username,
                    lastReadMessageId = it.lastReadMessageId,
                )
            }
    }

    @Transactional
    fun addParticipant(
        chatId: Long,
        requesterId: Long,
        userId: Long
    ) {
        val chat = findByIdOrThrow(chatId)

        if (chat.type != ChatType.GROUP) {
            throw CannotAddParticipantToPrivateChatException("Forbidden in private chat")
        }

        isChatParticipantOrThrow(chatId, requesterId)

        val user = userService.findByIdOrThrow(userId)

        val alreadyParticipant = chatParticipantRepository
            .existsByChat_IdAndUser_Id(chatId, userId)

        if (alreadyParticipant) {
            return
        }

        chatParticipantRepository.save(
            ChatParticipant(
                id = ChatParticipantId(chatId, userId),
                chat = chat,
                user = user
            )
        )
    }

    @Transactional
    fun leaveChat(chatId: Long, userId: Long) {
        val participant = chatParticipantRepository
            .findByChat_IdAndUser_Id(chatId, userId)
            ?: throw NotChatParticipantException("Forbidden")

        chatParticipantRepository.delete(participant)
    }

    @Transactional
    fun removeParticipant(
        chatId: Long,
        requesterId: Long,
        userId: Long
    ) {
        isChatParticipantOrThrow(chatId, requesterId)
        val participant = chatParticipantRepository
            .findByChat_IdAndUser_Id(chatId, userId)
            ?: throw NotChatParticipantException("Forbidden")
        chatParticipantRepository.delete(participant)
    }

    @Transactional
    fun handleMessageDeleted(deletedMessageId: Long, chatId: Long) {
        val chat = findByIdOrThrow(chatId)

        // Recalculate the chat's last visible message
        val newLast = messageRepository.findLastNonDeletedByChatId(chatId, PageRequest.of(0, 1)).firstOrNull()
        chat.lastMessageId = newLast?.id
        chat.lastMessageContent = newLast?.content
        chat.lastMessageCreatedAt = newLast?.createdAt
        chatRepository.save(chat)

        // Decrement unread count for any participant who had not yet read the deleted message
        val participants = chatParticipantRepository.findAllWithUserByChatId(chatId)
        participants.forEach { participant ->
            val lastReadId = participant.lastReadMessageId ?: -1L
            if (deletedMessageId > lastReadId && participant.unreadCount > 0) {
                participant.unreadCount--
            }
        }
        chatParticipantRepository.saveAll(participants)

        // Notify every participant's sidebar
        participants.forEach { participant ->
            messagingTemplate.convertAndSendToUser(
                participant.user.username,
                "/queue/chat-updates",
                ChatUpdateEvent(
                    chatId = chatId,
                    lastMessageContent = chat.lastMessageContent ?: "",
                    lastMessageCreatedAt = chat.lastMessageCreatedAt ?: Instant.now(),
                    unreadCount = participant.unreadCount,
                )
            )
        }
    }
}
