package com.daniel.messenger.storage

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "s3")
data class S3Properties(
    val accessKey: String,
    val secretKey: String,
    val region: String,
    val endpoint: String,
    val bucket: String,
    val fetchUrl: String,
)
