package com.daniel.messenger.security.repository

import com.daniel.messenger.security.entity.RefreshToken
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface RefreshTokenRepository : JpaRepository<RefreshToken, Long> {
    fun findByToken(refreshToken: String): RefreshToken?

    @Modifying
    @Query("""
        DELETE FROM RefreshToken WHERE expiryDate < CURRENT_TIMESTAMP
    """)
    fun deleteExpiredTokens()
}