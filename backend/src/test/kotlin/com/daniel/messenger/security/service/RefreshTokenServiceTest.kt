package com.daniel.messenger.security.service

import com.daniel.messenger.randomInstant
import com.daniel.messenger.randomRefreshToken
import com.daniel.messenger.randomString
import com.daniel.messenger.randomUser
import com.daniel.messenger.security.exception.InvalidRefreshTokenException
import com.daniel.messenger.security.exception.RefreshTokenExpiredException
import com.daniel.messenger.security.repository.RefreshTokenRepository
import com.daniel.messenger.user.service.UserService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentMatchers.any
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.then
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import java.time.Instant

@ExtendWith(MockitoExtension::class)
class RefreshTokenServiceTest {

    @Mock
    private lateinit var refreshTokenRepository: RefreshTokenRepository

    @Mock
    private lateinit var userService: UserService

    @Mock
    private lateinit var jwtService: JwtService

    private lateinit var refreshTokenService: RefreshTokenService

    private val user = randomUser()
    private val validRefreshToken = randomRefreshToken(user = user, expiryDate = randomInstant(3600))
    private val expiredRefreshToken = randomRefreshToken(user = user, expiryDate = randomInstant(-3600))
    private val unknownTokenStr = randomRefreshToken().token
    private val newAccessToken = randomString()

    @BeforeEach
    fun setUp() {
        refreshTokenService = RefreshTokenService(
            refreshTokenRepository = refreshTokenRepository,
            userService = userService,
            jwtService = jwtService,
            expirationDays = 7L
        )
    }

    @Test
    fun `createRefreshToken - should save a token with correct user and future expiry`() {
        given(userService.findByUsernameOrThrow(user.username)).willReturn(user)
        given(refreshTokenRepository.save(any())).willAnswer { it.getArgument(0) }

        val result = refreshTokenService.createRefreshToken(user.username)

        assertThat(result.user.username).isEqualTo(user.username)
        assertThat(result.token).isNotBlank()
        assertThat(result.expiryDate).isAfter(Instant.now())
    }

    @Test
    fun `rotateAccessToken - should return a new access token for a valid non-expired token`() {
        given(refreshTokenRepository.findByToken(validRefreshToken.token)).willReturn(validRefreshToken)
        given(jwtService.generateToken(user.username)).willReturn(newAccessToken)

        val result = refreshTokenService.rotateAccessToken(validRefreshToken.token)

        assertThat(result.accessToken).isEqualTo(newAccessToken)
    }

    @Test
    fun `rotateAccessToken - should throw RefreshTokenExpiredException and delete token when expired`() {
        given(refreshTokenRepository.findByToken(expiredRefreshToken.token)).willReturn(expiredRefreshToken)

        assertThrows<RefreshTokenExpiredException> { refreshTokenService.rotateAccessToken(expiredRefreshToken.token) }

        then(refreshTokenRepository).should().delete(expiredRefreshToken)
    }

    @Test
    fun `rotateAccessToken - should throw InvalidRefreshTokenException for an unknown token`() {
        given(refreshTokenRepository.findByToken(unknownTokenStr)).willReturn(null)

        assertThrows<InvalidRefreshTokenException> { refreshTokenService.rotateAccessToken(unknownTokenStr) }
    }

    @Test
    fun `deleteByToken - should delete the matching refresh token`() {
        given(refreshTokenRepository.findByToken(validRefreshToken.token)).willReturn(validRefreshToken)

        refreshTokenService.deleteByToken(validRefreshToken.token)

        then(refreshTokenRepository).should().delete(validRefreshToken)
    }

    @Test
    fun `deleteByToken - should throw InvalidRefreshTokenException for an unknown token`() {
        given(refreshTokenRepository.findByToken(unknownTokenStr)).willReturn(null)

        assertThrows<InvalidRefreshTokenException> { refreshTokenService.deleteByToken(unknownTokenStr) }
    }
}
