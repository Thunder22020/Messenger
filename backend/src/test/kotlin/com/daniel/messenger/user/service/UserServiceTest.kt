package com.daniel.messenger.user.service

import com.daniel.messenger.randomId
import com.daniel.messenger.randomString
import com.daniel.messenger.randomUser
import com.daniel.messenger.randomUserRequest
import com.daniel.messenger.randomUsername
import com.daniel.messenger.user.exception.UserAlreadyExistsException
import com.daniel.messenger.user.exception.UserNotFoundException
import com.daniel.messenger.user.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentMatchers.any
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.then
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.security.crypto.password.PasswordEncoder
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class UserServiceTest {

    @Mock
    private lateinit var userRepository: UserRepository

    @Mock
    private lateinit var encoder: PasswordEncoder

    @InjectMocks
    private lateinit var userService: UserService

    private val user = randomUser()
    private val request = randomUserRequest(username = user.username)
    private val currentUser = randomUser()
    private val otherUsers = listOf(randomUser(), randomUser())
    private val searchQuery = randomString()
    private val unknownId = randomId()
    private val unknownUsername = randomUsername()

    @Test
    fun `save - should save and return user when username is not taken`() {
        given(userRepository.findByUsername(request.username)).willReturn(null)
        given(encoder.encode(request.password)).willReturn(user.password)
        given(userRepository.save(any())).willReturn(user)

        val result = userService.save(request)

        assertThat(result.username).isEqualTo(request.username)
        assertThat(result.password).isEqualTo(user.password)
    }

    @Test
    fun `save - should throw UserAlreadyExistsException when username is already taken`() {
        given(userRepository.findByUsername(request.username)).willReturn(user)

        assertThrows<UserAlreadyExistsException> { userService.save(request) }

        then(userRepository).shouldHaveNoMoreInteractions()
    }

    @Test
    fun `searchUsers - should return matching users excluding the current user`() {
        given(userRepository.findTop50ByUsernameStartingWithAndIdNot(searchQuery, currentUser.id!!)).willReturn(otherUsers)

        val result = userService.searchUsers(searchQuery, currentUserId = currentUser.id!!)

        assertThat(result).hasSize(2)
        assertThat(result.map { it.id }).doesNotContain(currentUser.id)
    }

    @Test
    fun `findByUsernameOrThrow - should return user when found`() {
        given(userRepository.findByUsername(user.username)).willReturn(user)

        val result = userService.findByUsernameOrThrow(user.username)

        assertThat(result.username).isEqualTo(user.username)
    }

    @Test
    fun `findByUsernameOrThrow - should throw UserNotFoundException when user does not exist`() {
        given(userRepository.findByUsername(unknownUsername)).willReturn(null)

        assertThrows<UserNotFoundException> { userService.findByUsernameOrThrow(unknownUsername) }
    }

    @Test
    fun `findByIdOrThrow - should return user when found`() {
        given(userRepository.findById(user.id!!)).willReturn(Optional.of(user))

        val result = userService.findByIdOrThrow(user.id!!)

        assertThat(result.id).isEqualTo(user.id)
    }

    @Test
    fun `findByIdOrThrow - should throw UserNotFoundException when user does not exist`() {
        given(userRepository.findById(unknownId)).willReturn(Optional.empty())

        assertThrows<UserNotFoundException> { userService.findByIdOrThrow(unknownId) }
    }
}
