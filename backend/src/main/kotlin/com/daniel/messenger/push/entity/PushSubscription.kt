package com.daniel.messenger.push.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(
    name = "push_subscriptions",
    indexes = [Index(name = "idx_push_sub_username", columnList = "username")]
)
class PushSubscription(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(nullable = false)
    var username: String,
    @Column(nullable = false, length = 2048)
    var endpoint: String,
    @Column(nullable = false)
    var p256dh: String,
    @Column(nullable = false)
    var auth: String,
    var createdAt: Instant = Instant.now(),
)
