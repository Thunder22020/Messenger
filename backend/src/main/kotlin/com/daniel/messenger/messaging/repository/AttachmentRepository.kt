package com.daniel.messenger.messaging.repository

import com.daniel.messenger.messaging.entity.Attachment
import com.daniel.messenger.messaging.entity.MessageEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import org.springframework.data.domain.Pageable

@Repository
interface AttachmentRepository : JpaRepository<Attachment, Long> {
    @Query("SELECT a FROM Attachment a WHERE a.message.id IN :messageIds")
    fun findAllByMessageIdIn(@Param("messageIds") messageIds: Collection<Long>): List<Attachment>

    fun findAllByMessageId(messageId: Long): List<Attachment>

    @Query("SELECT EXISTS(SELECT 1 FROM attachments WHERE message_id = :messageId)", nativeQuery = true)
    fun existsByMessageId(@Param("messageId") messageId: Long): Boolean

    @Modifying
    @Query(
        """
        DELETE FROM attachments
        WHERE message_id = :messageId
        RETURNING file_path
        """,
        nativeQuery = true
    )
    fun deleteByMessageIdReturningFilePaths(@Param("messageId") messageId: Long): List<String>

    @Modifying
    @Query(
        """
        DELETE FROM attachments
        WHERE message_id IN (SELECT id FROM messages WHERE chat_id = :chatId)
        RETURNING file_path
        """,
        nativeQuery = true
    )
    fun deleteByChatIdReturningFilePaths(@Param("chatId") chatId: Long): List<String>

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Attachment a SET a.message = :message WHERE a.id IN :ids")
    fun bulkLinkToMessage(@Param("ids") ids: List<Long>, @Param("message") message: MessageEntity): Int

    @Query("""
        SELECT att
        FROM Attachment att
        JOIN FETCH att.message m
        JOIN FETCH m.sender
        WHERE m.chat.id = :chatId
            AND m.deletedAt IS NULL
            AND att.attachmentType IN ('PHOTO', 'VIDEO')
        ORDER BY att.id DESC
    """)
    fun findAllMediaByChatId(chatId: Long, pageable: Pageable): List<Attachment>

    @Query("""
        SELECT att
        FROM Attachment att
        JOIN FETCH att.message m
        JOIN FETCH m.sender
        WHERE m.chat.id = :chatId
            AND m.deletedAt IS NULL
            AND att.attachmentType IN ('PHOTO', 'VIDEO')
            AND att.id < :before
        ORDER BY att.id DESC
    """)
    fun findAllMediaByChatIdBefore(chatId: Long, @Param("before") before: Long, pageable: Pageable): List<Attachment>

    @Query("""
        SELECT att
        FROM Attachment att
        JOIN FETCH att.message m
        JOIN FETCH m.sender
        WHERE m.chat.id = :chatId
            AND m.deletedAt IS NULL
            AND att.attachmentType IN ('FILE', 'AUDIO')
        ORDER BY att.id DESC
    """)
    fun findAllFilesByChatId(chatId: Long, pageable: Pageable): List<Attachment>

    @Query("""
        SELECT att
        FROM Attachment att
        JOIN FETCH att.message m
        JOIN FETCH m.sender
        WHERE m.chat.id = :chatId
            AND m.deletedAt IS NULL
            AND att.attachmentType IN ('FILE', 'AUDIO')
            AND att.id < :before
        ORDER BY att.id DESC
    """)
    fun findAllFilesByChatIdBefore(chatId: Long, @Param("before") before: Long, pageable: Pageable): List<Attachment>
}
