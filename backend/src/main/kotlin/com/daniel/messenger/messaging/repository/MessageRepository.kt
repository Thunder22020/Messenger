package com.daniel.messenger.messaging.repository

import com.daniel.messenger.messaging.entity.MessageEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface MessageRepository : JpaRepository<MessageEntity, Long> {
    @Query("SELECT m FROM MessageEntity m JOIN FETCH m.sender WHERE m.id = :id")
    fun findByIdWithSender(@Param("id") id: Long): MessageEntity?

    @Query("SELECT m FROM MessageEntity m JOIN FETCH m.sender WHERE m.chat.id = :chatId ORDER BY m.id ASC")
    fun findAllByChat_IdOrderByIdAsc(@Param("chatId") chatId: Long): List<MessageEntity>

    @Query("SELECT m FROM MessageEntity m JOIN FETCH m.sender WHERE m.chat.id = :chatId ORDER BY m.id DESC")
    fun findLatestByChatId(@Param("chatId") chatId: Long, pageable: Pageable): List<MessageEntity>

    @Query("SELECT m FROM MessageEntity m JOIN FETCH m.sender WHERE m.chat.id = :chatId AND m.id < :beforeId ORDER BY m.id DESC")
    fun findByChatIdAndIdBefore(
        @Param("chatId") chatId: Long,
        @Param("beforeId") beforeId: Long,
        pageable: Pageable,
    ): List<MessageEntity>

    @Query("SELECT m FROM MessageEntity m JOIN FETCH m.sender WHERE m.chat.id = :chatId AND m.id > :afterId ORDER BY m.id ASC")
    fun findByChatIdAndIdAfter(
        @Param("chatId") chatId: Long,
        @Param("afterId") afterId: Long,
        pageable: Pageable,
    ): List<MessageEntity>

    @Query("SELECT m FROM MessageEntity m JOIN FETCH m.sender WHERE m.chat.id = :chatId AND m.deletedAt IS NULL ORDER BY m.id DESC")
    fun findLastNonDeletedByChatId(
        @Param("chatId") chatId: Long,
        pageable: Pageable,
    ): List<MessageEntity>
}
