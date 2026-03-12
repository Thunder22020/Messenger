package com.daniel.messenger.messaging.entity

import com.daniel.messenger.user.entity.User
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.MapsId
import jakarta.persistence.Table
import java.io.Serializable
import java.time.Instant

@Entity
@Table(name = "chat_participants")
data class ChatParticipant(
    @EmbeddedId
    var id: ChatParticipantId = ChatParticipantId(),

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("chatId")
    @JoinColumn(name = "chat_id")
    var chat: Chat,

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    var user: User,

    @Column(nullable = false)
    var joinedAt: Instant = Instant.now(),

    var lastReadMessageId: Long? = null,

    @Column(nullable = false)
    var unreadCount: Long = 0
)

@Embeddable
data class ChatParticipantId(
    @Column(name = "chat_id")
    var chatId: Long? = null,

    @Column(name = "user_id")
    var userId: Long? = null
) : Serializable
