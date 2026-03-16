package com.daniel.messenger.security.userdetails

import com.daniel.messenger.user.repository.UserRepository
import org.springframework.cache.annotation.Cacheable
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service

@Service
class UserDetailsServiceImpl(
    private var userRepository: UserRepository,
) : UserDetailsService {
    @Cacheable("userDetails", key="#username")
    override fun loadUserByUsername(username: String): UserDetails {
        val user = userRepository.findByUsername(username)

        if (user == null) {
            throw UsernameNotFoundException("User not found")
        }
        return UserPrincipal(user)
    }
}