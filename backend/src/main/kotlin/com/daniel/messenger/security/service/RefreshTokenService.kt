package com.daniel.messenger.security.service

import com.daniel.messenger.security.dto.AccessTokenResponse
import com.daniel.messenger.security.entity.RefreshToken
import com.daniel.messenger.security.exception.InvalidRefreshTokenException
import com.daniel.messenger.security.exception.RefreshTokenExpiredException
import com.daniel.messenger.security.repository.RefreshTokenRepository
import com.daniel.messenger.user.service.UserService
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class RefreshTokenService(
    private val refreshTokenRepository: RefreshTokenRepository,
    private val userService: UserService,
    private val jwtService: JwtService,
    @Value("\${app.jwt.refresh-expiration}")
    private val expirationDays: Long
) {
    fun createRefreshToken(username: String) : RefreshToken =
        refreshTokenRepository.save(
            RefreshToken(
                token = UUID.randomUUID().toString(),
                expiryDate = Instant.now().plus(expirationDays, ChronoUnit.DAYS),
                user = userService.findByUsernameOrThrow(username)
            )
        )

    private fun verifyExpiration(token: RefreshToken) {
        val now = Instant.now()
        if (token.expiryDate.isBefore(now)) {
            refreshTokenRepository.delete(token)
            throw RefreshTokenExpiredException(
                "Refresh token ${token.token.take(5)}... has expired. Please sign in"
            )
        }
    }

    fun rotateAccessToken(token: String): AccessTokenResponse {
        val refresh = getByTokenOrThrow(token)
        verifyExpiration(refresh)
        val newAccess = jwtService.generateToken(refresh.user.username)
        return AccessTokenResponse(newAccess)
    }

    fun deleteByToken(token: String) {
        val refreshToken = getByTokenOrThrow(token)
        refreshTokenRepository.delete(refreshToken)
    }

    private fun getByTokenOrThrow(token: String) =
        refreshTokenRepository.findByToken(token)
            ?: throw InvalidRefreshTokenException(
                "Refresh token ${token.take(5)}... not found"
            )

    @Transactional
    fun deleteExpiredTokens() {
        refreshTokenRepository.deleteExpiredTokens()
    }
}
