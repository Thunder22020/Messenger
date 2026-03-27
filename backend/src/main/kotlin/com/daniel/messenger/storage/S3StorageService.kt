package com.daniel.messenger.storage

import com.daniel.messenger.messaging.service.AttachmentService
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import java.io.InputStream

@Service
class S3StorageService(
    private val s3Client: S3Client,
    private val props: S3Properties,
) {
    private val log = LoggerFactory.getLogger(AttachmentService::class.java)

    fun upload(key: String, inputStream: InputStream, contentType: String, size: Long): String {
        s3Client.putObject(
            PutObjectRequest.builder()
                .bucket(props.bucket)
                .key(key)
                .contentType(contentType)
                .contentLength(size)
                .build(),
            RequestBody.fromInputStream(inputStream, size),
        )
        return "${props.fetchUrl.trimEnd('/')}/$key"
    }

    fun delete(key: String) {
        s3Client.deleteObject(
            DeleteObjectRequest.builder()
                .bucket(props.bucket)
                .key(key)
                .build()
        )
    }

    @Async
    fun deleteFromS3Async(keys: List<String>) {
        keys.forEach { deleteFromS3OrLog(it) }
    }

    private fun deleteFromS3OrLog(key: String) {
        try {
            delete(key)
        } catch (e: Exception) {
            log.warn("Failed to delete S3 object: {}", key, e)
        }
    }
}
