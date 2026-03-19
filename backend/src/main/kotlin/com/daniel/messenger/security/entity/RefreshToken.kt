package com.daniel.messenger.security.entity

import com.daniel.messenger.user.entity.User
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "refresh_token", indexes = [
    Index(name = "idx_refresh_token_token", columnList = "token")
])
data class RefreshToken(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    var token: String,
    var expiryDate: Instant,

    @ManyToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id")
    var user: User,
)
