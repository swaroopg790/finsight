package com.finsight.portfolio.api.exception;

/** Thrown when a resource is not found or does not belong to the requesting user. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
