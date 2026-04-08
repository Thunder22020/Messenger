package com.daniel.messenger.messaging.repository

import com.daniel.messenger.messaging.entity.MessageReaction
import com.daniel.messenger.messaging.entity.MessageReactionId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.stereotype.Repository

@Repository
interface MessageReactionRepository : JpaRepository<MessageReaction, MessageReactionId> {
    fun findAllByMessageId(messageId: Long): List<MessageReaction>
    fun findAllByMessageIdIn(messageIds: List<Long>): List<MessageReaction>
    fun existsByMessageIdAndUserIdAndEmoji(messageId: Long, userId: Long, emoji: String): Boolean

    @Modifying
    fun deleteByMessageIdAndUserIdAndEmoji(messageId: Long, userId: Long, emoji: String)
}
