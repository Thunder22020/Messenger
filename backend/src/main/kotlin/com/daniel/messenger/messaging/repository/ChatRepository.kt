package com.daniel.messenger.messaging.repository

import com.daniel.messenger.messaging.entity.Chat
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface ChatRepository : JpaRepository<Chat, Long> {
    @Query("""
    SELECT DISTINCT c
    FROM Chat c
    JOIN FETCH c.participants p
    JOIN FETCH p.user
    WHERE c.id IN (
        SELECT cp.chat.id
        FROM ChatParticipant cp
        WHERE cp.user.id = :userId
    )
    """)
    fun findAllUserChatsWithParticipants(@Param("userId") userId: Long): List<Chat>
}
