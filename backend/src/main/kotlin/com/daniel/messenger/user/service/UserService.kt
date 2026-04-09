package com.daniel.messenger.user.service

import com.daniel.messenger.user.dto.RegisterRequest
import com.daniel.messenger.user.dto.UserRequest
import com.daniel.messenger.user.dto.UserSearchResponse
import com.daniel.messenger.user.entity.User
import com.daniel.messenger.user.exception.UserAlreadyExistsException
import com.daniel.messenger.user.exception.UserNotFoundException
import com.daniel.messenger.user.repository.UserRepository
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserService(
    private val userRepository: UserRepository,
    private val encoder: PasswordEncoder
) {
    fun save(dto: RegisterRequest): User {
        if (userRepository.findByUsername(dto.username) != null) {
            throw UserAlreadyExistsException("User already exists")
        }

        val entity = User(
            username = dto.username,
            password = requireNotNull(encoder.encode(dto.password))
        )

        return userRepository.save(entity)
    }

    fun searchUsers(query: String, currentUserId: Long) =
        userRepository
            .findTop50ByUsernameStartingWithAndIdNot(query, currentUserId)
            .map { it.toSearchResponse() }

    fun User.toSearchResponse() = UserSearchResponse(
        id = requireNotNull(id),
        username = username,
        displayName = displayName,
        avatarUrl = avatarUrl,
    )

    @Transactional
    fun updateDisplayName(userId: Long, displayName: String?) {
        val user = findByIdOrThrow(userId)
        user.displayName = displayName?.takeIf { it.isNotBlank() }
        userRepository.save(user)
    }

    @Transactional
    fun updateAvatarUrl(userId: Long, avatarUrl: String) {
        val user = findByIdOrThrow(userId)
        user.avatarUrl = avatarUrl
        userRepository.save(user)
    }

    fun findByUsernameOrThrow(username: String) =
        userRepository.findByUsername(username)
            ?: throw UserNotFoundException("User $username not found")

    fun findByIdOrThrow(id: Long): User =
        userRepository.findById(id).orElseThrow {
            UserNotFoundException("User with ID:$id not found")
        }

    fun findAllByIds(ids: List<Long>): List<User> = userRepository.findAllById(ids)

    fun getReference(id: Long): User = userRepository.getReferenceById(id)

    fun lockById(id: Long) {
        userRepository.findByIdWithLock(id)
    }
}