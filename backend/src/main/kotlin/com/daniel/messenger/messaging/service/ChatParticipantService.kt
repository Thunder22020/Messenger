package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.event.ChatUpdateEvent
import com.daniel.messenger.messaging.dto.event.ChatUpdateType
import com.daniel.messenger.messaging.dto.event.MessageSentEvent
import com.daniel.messenger.messaging.dto.event.snapshots.ParticipantSnapshot
import com.daniel.messenger.messaging.dto.event.ReadAckEvent
import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.entity.ChatParticipantId
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.enum.ChatType
import com.daniel.messenger.messaging.enum.MessageType
import com.daniel.messenger.messaging.exception.CannotAddParticipantToPrivateChatException
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.messaging.repository.MessageRepository
import com.daniel.messenger.messaging.toResponse
import com.daniel.messenger.user.service.UserService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ChatParticipantService(
    private val chatAccessService: ChatAccessService,
    private val chatParticipantRepository: ChatParticipantRepository,
    private val chatService: ChatService,
    private val messageRepository: MessageRepository,
    private val eventPublisher: ApplicationEventPublisher,
    private val userService: UserService,
    private val chatNotificationService: ChatNotificationService
) {
    @Transactional
    fun removeParticipant(chatId: Long, requesterId: Long, userId: Long) {
        chatAccessService.isChatParticipantOrThrow(chatId, requesterId)
        val participant = chatAccessService.getChatParticipantOrThrow(chatId, userId)
        chatParticipantRepository.delete(participant)
    }

    @Transactional
    fun leaveChat(chatId: Long, userId: Long) {
        val participant = chatAccessService.getChatParticipantOrThrow(chatId, userId)
        val username = participant.user.username
        val chat = chatService.findByIdOrThrow(chatId)

        chatParticipantRepository.delete(participant)
        chatParticipantRepository.flush()

        val remainingParticipants = chatParticipantRepository.findAllWithUserByChatId(chatId)

        if (remainingParticipants.isEmpty()) {
            chatService.deleteChat(chatId)
            return
        }

        val systemMessage = messageRepository.save(
            MessageEntity(
                sender = null,
                content = "$username left the group",
                chat = chat,
                type = MessageType.SYSTEM,
            )
        )

        chatService.updateChatLastMessage(chat, systemMessage)

        val viewingUserIds = chatNotificationService.getViewingUserIds(chatId, remainingParticipants)
        chatParticipantRepository.bulkUpdateUnreadCountsNotInViewing(chatId, -1L, viewingUserIds)

        val participantSnapshots = remainingParticipants.map {
            val isViewing = it.user.id in viewingUserIds
            ParticipantSnapshot(username = it.user.username, unreadCount = it.unreadCount + if (isViewing) 0 else 1)
        }
        eventPublisher.publishEvent(
            MessageSentEvent(
                chatId = chatId,
                response = systemMessage.toResponse(),
                participants = participantSnapshots,
            )
        )
    }

    @Transactional
    fun addParticipants(chatId: Long, requesterId: Long, userIds: List<Long>) {
        val chat = chatService.findByIdOrThrow(chatId)
        if (chat.type != ChatType.GROUP) {
            throw CannotAddParticipantToPrivateChatException("Forbidden in private chat")
        }
        chatAccessService.isChatParticipantOrThrow(chatId, requesterId)

        val requester = userService.findByIdOrThrow(requesterId)
        val usersToAdd = userService.findAllByIds(userIds)

        for (user in usersToAdd) {
            val uid = requireNotNull(user.id)
            chatParticipantRepository.save(
                ChatParticipant(id = ChatParticipantId(chatId, uid), chat = chat, user = user)
            )
        }

        val participants = chatParticipantRepository.findAllWithUserByChatId(chatId)
        var lastSystemMessage: MessageEntity? = null

        for (user in usersToAdd) {
            val systemMessage = messageRepository.save(
                MessageEntity(
                    sender = null,
                    content = "${requester.username} added ${user.username} to group",
                    chat = chat,
                    type = MessageType.SYSTEM,
                )
            )
            lastSystemMessage = systemMessage

            val viewingUserIds = chatNotificationService.getViewingUserIds(chatId, participants)
            chatParticipantRepository.bulkUpdateUnreadCountsNotInViewing(chatId, requesterId, viewingUserIds)

            val participantSnapshots = participants.map {
                val isRequester = it.user.id == requesterId
                val isViewing = it.user.id in viewingUserIds
                ParticipantSnapshot(
                    username = it.user.username,
                    unreadCount = it.unreadCount + if (isRequester || isViewing) 0 else 1,
                )
            }
            eventPublisher.publishEvent(
                MessageSentEvent(
                    chatId = chatId,
                    response = systemMessage.toResponse(),
                    participants = participantSnapshots,
                )
            )
        }

        if (lastSystemMessage != null) {
            chatService.updateChatLastMessage(chat, lastSystemMessage)
        }
    }

    @Transactional
    fun markAsRead(chatId: Long, userId: Long) {
        val chat = chatService.findByIdOrThrow(chatId)
        val participant = chatAccessService.getChatParticipantOrThrow(chatId, userId)

        participant.unreadCount = 0
        participant.lastReadMessageId = chat.lastMessageId

        chatNotificationService.sendSidebarUpdate(
            participant.user.username,
            ChatUpdateEvent(
                chatId = chatId,
                type = ChatUpdateType.READ_ACK,
                unreadCount = 0,
            ),
        )

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
}