console.log('hi guys');

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Navi...');
    if (audioInput) {
        audioInput.quit();
    }
    process.exit(0);
});

// Start the application
main().catch(console.error);
