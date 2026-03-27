package com.daniel.messenger.messaging.entity

import com.daniel.messenger.messaging.enum.MessageType
import com.daniel.messenger.user.entity.User
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import java.time.Instant


@Entity
@Table(name = "messages", indexes = [
    Index(name = "idx_messages_chat_id", columnList = "chat_id, id")
])
class MessageEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = true)
    var sender: User?,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var type: MessageType = MessageType.REGULAR,

    @Column(columnDefinition = "TEXT")
    var content: String?,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_id", nullable = false)
    var chat: Chat,

    @OneToMany(mappedBy = "message", cascade = [CascadeType.ALL], orphanRemoval = true)
    var attachments: MutableList<Attachment> = mutableListOf(),

    var createdAt: Instant = Instant.now(),

    var editedAt: Instant? = null,

    var deletedAt: Instant? = null,

    var replyToMessageId: Long? = null,
)
