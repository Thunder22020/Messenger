package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.event.ReactionUpdatedEvent
import com.daniel.messenger.messaging.dto.response.ReactionDto
import com.daniel.messenger.messaging.dto.response.WsReactionDto
import com.daniel.messenger.messaging.entity.MessageReaction
import com.daniel.messenger.messaging.exception.MessageNotFoundException
import com.daniel.messenger.messaging.repository.MessageReactionRepository
import com.daniel.messenger.messaging.repository.MessageRepository
import com.daniel.messenger.user.service.UserService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ReactionService(
    private val messageReactionRepository: MessageReactionRepository,
    private val messageRepository: MessageRepository,
    private val chatAccessService: ChatAccessService,
    private val userService: UserService,
    private val eventPublisher: ApplicationEventPublisher,
) {
    @Transactional
    fun toggleReaction(messageId: Long, userId: Long, emoji: String) {
        val message = messageRepository.findByIdWithSender(messageId)
            ?: throw MessageNotFoundException("Message $messageId not found")

        val chatId = requireNotNull(message.chat.id)
        chatAccessService.isChatParticipantOrThrow(chatId, userId)

        if (messageReactionRepository.existsByMessageIdAndUserIdAndEmoji(messageId, userId, emoji)) {
            messageReactionRepository.deleteByMessageIdAndUserIdAndEmoji(messageId, userId, emoji)
        } else {
            messageReactionRepository.save(MessageReaction(messageId, userId, emoji))
        }

        val allRows = messageReactionRepository.findAllByMessageId(messageId)
        val usernameMap = userService.findAllByIds(allRows.map { it.userId }.distinct())
            .associate { requireNotNull(it.id) to it.username }
        val wsReactions = allRows
            .groupBy { it.emoji }
            .map { (e, group) ->
                WsReactionDto(
                    emoji = e,
                    count = group.size,
                    reactorUsernames = group.mapNotNull { usernameMap[it.userId] },
                )
            }
            .sortedWith(compareByDescending<WsReactionDto> { it.count }.thenBy { it.emoji })

        eventPublisher.publishEvent(ReactionUpdatedEvent(chatId, messageId, wsReactions))
    }
}
