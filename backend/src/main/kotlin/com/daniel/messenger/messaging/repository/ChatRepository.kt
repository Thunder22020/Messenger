package com.daniel.messenger.messaging.repository

import com.daniel.messenger.messaging.entity.Chat
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.Instant

interface MyChatProjection {
    fun getChatId(): Long
    fun getType(): String
    fun getTitle(): String?
    fun getLastMessageContent(): String?
    fun getLastMessageSender(): String?
    fun getLastMessageCreatedAt(): Instant?
    fun getUnreadCount(): Long
    fun getLastReadMessageId(): Long?
    fun getLastMessageId(): Long?
    fun getPeerLastReadMessageId(): Long?
    fun getPinnedAt(): Instant?
}

interface PrivateChatDisplayName {
    fun getChatId(): Long
    fun getUsername(): String
    fun getDisplayName(): String?
    fun getAvatarUrl(): String?
}

@Repository
interface ChatRepository : JpaRepository<Chat, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Chat c WHERE c.id = :id")
    fun findByIdWithLock(@Param("id") id: Long): Chat?

    @Query(
        value = """
            SELECT
                c.id AS chatId,
                c.type AS type,
                c.title AS title,
                c.last_message_content AS lastMessageContent,
                c.last_message_sender AS lastMessageSender,
                c.last_message_created_at AS lastMessageCreatedAt,
                cp.unread_count AS unreadCount,
                cp.last_read_message_id AS lastReadMessageId,
                c.last_message_id AS lastMessageId,
                (
                    SELECT MAX(cp2.last_read_message_id)
                    FROM chat_participants cp2
                    WHERE cp2.chat_id = c.id AND cp2.user_id != :userId
                ) AS peerLastReadMessageId,
                cp.pinned_at AS pinnedAt
            FROM chats c
            JOIN chat_participants cp ON cp.chat_id = c.id AND cp.user_id = :userId
            ORDER BY
                cp.pinned_at ASC NULLS LAST,
                c.last_message_created_at DESC NULLS LAST
        """,
        nativeQuery = true
    )
    fun findMyChats(@Param("userId") userId: Long): List<MyChatProjection>

    @Query(
        value = """
            SELECT cp.chat_id AS chatId, u.username AS username, u.display_name AS displayName, u.avatar_url AS avatarUrl
            FROM chat_participants cp
            JOIN users u ON u.id = cp.user_id
            WHERE cp.chat_id IN (:chatIds) AND cp.user_id != :userId
        """,
        nativeQuery = true
    )
    fun findPrivateChatDisplayNames(
        @Param("chatIds") chatIds: List<Long>,
        @Param("userId") userId: Long,
    ): List<PrivateChatDisplayName>
}
