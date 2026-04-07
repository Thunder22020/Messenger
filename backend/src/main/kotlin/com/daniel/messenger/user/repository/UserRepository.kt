package com.daniel.messenger.user.repository

import com.daniel.messenger.user.entity.User
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
interface UserRepository : JpaRepository<User, Long> {
    fun findByUsername(username: String): User?
    fun findTop50ByUsernameStartingWithAndIdNot(query: String, excludeId: Long): List<User>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    fun findByIdWithLock(@Param("id") id: Long): User?

    @Modifying
    @Query("UPDATE User u SET u.lastSeenAt = :lastSeenAt WHERE u.username = :username")
    fun updateLastSeenAt(@Param("username") username: String, @Param("lastSeenAt") lastSeenAt: Instant)
}