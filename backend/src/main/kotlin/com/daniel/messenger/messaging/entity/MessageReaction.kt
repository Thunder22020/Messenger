package com.daniel.messenger.messaging.entity

import jakarta.persistence.*
import java.io.Serializable
import java.time.Instant

@Entity
@Table(name = "message_reactions")
@IdClass(MessageReactionId::class)
class MessageReaction(
    @Id
    @Column(name = "message_id")
    val messageId: Long,

    @Id
    @Column(name = "user_id")
    val userId: Long,

    @Id
    val emoji: String,

    val createdAt: Instant = Instant.now(),
)

data class MessageReactionId(
    val messageId: Long = 0,
    val userId: Long = 0,
    val emoji: String = "",
) : Serializable
