package com.daniel.messenger.security.repository

import com.daniel.messenger.security.entity.RefreshToken
import org.springframework.data.jpa.repository.JpaRepository

interface RefreshTokenRepository : JpaRepository<RefreshToken, Long> {
    fun findByToken(refreshToken: String): RefreshToken?
}