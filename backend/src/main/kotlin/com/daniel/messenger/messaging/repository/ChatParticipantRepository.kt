package com.daniel.messenger.messaging.repository

import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.entity.ChatParticipantId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface ChatParticipantRepository : JpaRepository<ChatParticipant, ChatParticipantId> {
    fun existsByChat_IdAndUser_Id(chatId: Long, userId: Long): Boolean

    fun findByChat_IdAndUser_Id(chatId: Long, userId: Long): ChatParticipant?

    @Query("""
    SELECT cp FROM ChatParticipant cp
    JOIN FETCH cp.user
    WHERE cp.chat.id = :chatId
    """)
    fun findAllWithUserByChatId(@Param("chatId") chatId: Long): List<ChatParticipant>

    @Query("""
        SELECT cp.chat.id
        FROM ChatParticipant cp
        WHERE cp.chat.type = com.daniel.messenger.messaging.enum.ChatType.PRIVATE
          AND cp.id.chatId IN (
              SELECT cp2.id.chatId
              FROM ChatParticipant cp2
              WHERE cp2.id.userId IN :userIds
              GROUP BY cp2.id.chatId
              HAVING COUNT(cp2.id.chatId) = 2
          )
    """)
    fun findPrivateChatIdByUserIds(userIds: List<Long>): Long?

    @Modifying
    @Query("""
        UPDATE ChatParticipant
        SET unreadCount = unreadCount + 1
        WHERE chat.id=:chatId
            AND user.id != :senderId
            AND user.id NOT IN (:viewingUserIds)
    """)
    fun bulkUpdateUnreadCountsNotInViewing(
        @Param("chatId") chatId: Long,
        @Param("senderId") senderId: Long,
        @Param("viewingUserIds") viewingUserIds: List<Long>
    )

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
        UPDATE ChatParticipant
        SET unreadCount = unreadCount - 1
        WHERE chat.id=:chatId AND (lastReadMessageId IS NULL OR :deletedMessageId > lastReadMessageId) AND unreadCount > 0
    """)
    fun bulkDecrementUnreadCounts(
        @Param("chatId") chatId: Long,
        @Param("deletedMessageId") deletedMessageId: Long
    )
}
