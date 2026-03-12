package com.daniel.messenger.security.service

import com.daniel.messenger.randomSecret
import com.daniel.messenger.randomUsername
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class JwtServiceTest {

    private val jwtService = JwtService(randomSecret(), expiration = FIVE_MINS_DURATION)

    private fun expiredTokenFor(username: String) =
        JwtService(randomSecret(), expiration = EXPIRED_DURATION).generateToken(username)

    @Test
    fun `generateToken - should produce a non-blank JWT for a given username`() {
        val token = jwtService.generateToken(randomUsername())

        assertThat(token).isNotBlank()
    }

    @Test
    fun `extractUsername - should return the username embedded in the token`() {
        val username = randomUsername()
        val token = jwtService.generateToken(username)

        assertThat(jwtService.extractUsername(token)).isEqualTo(username)
    }

    @Test
    fun `validateToken - should return true for a fresh valid token`() {
        val username = randomUsername()
        val token = jwtService.generateToken(username)

        assertThat(jwtService.validateToken(token, username)).isTrue()
    }

    @Test
    fun `validateToken - should return false when the username does not match the token`() {
        val token = jwtService.generateToken(randomUsername())

        assertThat(jwtService.validateToken(token, randomUsername())).isFalse()
    }

    @Test
    fun `validateToken - should return false for an already expired token`() {
        val username = randomUsername()

        assertThat(jwtService.validateToken(expiredTokenFor(username), username)).isFalse()
    }

    companion object {
        private const val FIVE_MINS_DURATION = 300_000L;
        private const val EXPIRED_DURATION = -1L;
    }
}
