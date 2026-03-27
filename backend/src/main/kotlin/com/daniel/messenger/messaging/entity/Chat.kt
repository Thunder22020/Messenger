package com.daniel.messenger.messaging.entity

import com.daniel.messenger.messaging.enum.ChatType
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import java.time.Instant


@Entity
@Table(name = "chats")
class Chat(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    var type: ChatType,

    var title: String? = null,

    var lastMessageId: Long? = null,

    @Column(columnDefinition = "TEXT")
    var lastMessageContent: String? = null,

    var lastMessageSender: String? = null,

    var lastMessageCreatedAt: Instant? = null,

    @Column(nullable = false)
    var createdAt: Instant = Instant.now(),

    @OneToMany(mappedBy = "chat", fetch = FetchType.LAZY, cascade = [CascadeType.ALL], orphanRemoval = true)
    var participants: MutableList<ChatParticipant> = mutableListOf(),

    @OneToMany(mappedBy = "chat", fetch = FetchType.LAZY, cascade = [CascadeType.ALL], orphanRemoval = true)
    var messages: MutableList<MessageEntity> = mutableListOf()
)
