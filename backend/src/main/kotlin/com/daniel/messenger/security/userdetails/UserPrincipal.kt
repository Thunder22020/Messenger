package com.daniel.messenger.security.userdetails

import com.daniel.messenger.user.entity.User
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.UserDetails
import java.io.Serializable
import java.util.Collections

class UserPrincipal(
    val user: User,
) : UserDetails {
    override fun getAuthorities(): Collection<out GrantedAuthority> {
        return Collections.singletonList(SimpleGrantedAuthority("USER"))
    }

    override fun getPassword(): String? {
        return user.password
    }

    override fun getUsername(): String {
        return user.username
    }

    override fun isAccountNonExpired(): Boolean {
        return true
    }

    override fun isAccountNonLocked(): Boolean {
        return true
    }

    override fun isCredentialsNonExpired(): Boolean {
        return true
    }

    override fun isEnabled(): Boolean {
        return true
    }

    companion object {
        private const val serialVersionUID = 1L
    }
}