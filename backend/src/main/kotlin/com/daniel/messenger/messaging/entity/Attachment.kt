package com.daniel.messenger.messaging.entity

import com.daniel.messenger.messaging.enum.AttachmentType
import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "attachments")
class Attachment(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id")
    var message: MessageEntity? = null,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    var attachmentType: AttachmentType,

    @Column(nullable = false)
    var fileName: String,

    @Column(nullable = false)
    var mimeType: String,

    var fileSize: Long,

    @Column(nullable = false)
    var filePath: String,

    var createdAt: Instant = Instant.now(),
)
