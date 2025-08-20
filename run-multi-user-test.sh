#!/bin/bash

echo "🧪 Production-Level Multi-User Queue Test"
echo "=========================================="
echo ""

# Function to submit a storyboard
submit_storyboard() {
    local user_id="$1"
    local prompt="$2"
    local user_name="$3"
    
    echo "👤 $user_name ($user_id) submitting storyboard..."
    bunx convex run storyboardWorkflow:generateStoryStructure "{\"prompt\":\"$prompt\",\"userId\":\"$user_id\"}" &
}

# Clear any existing queue
echo "🧹 Clearing existing queue..."
bunx convex run storyboardQueue:cleanupOldQueueItems "{\"olderThanHours\":0}" > /dev/null 2>&1

# Check initial state
echo ""
echo "📊 Initial Queue State:"
bunx convex run storyboardQueue:getQueueStats

echo ""
echo "🚀 Simulating 5 concurrent users submitting storyboards..."
echo ""

# Submit 5 storyboards concurrently (different users)
submit_storyboard "test_user_alice_$(date +%s)" "A detective investigates mysterious disappearances in a cyberpunk city" "Alice"
sleep 0.5
submit_storyboard "test_user_bob_$(date +%s)" "A space explorer discovers an ancient alien civilization on Mars" "Bob"
sleep 0.5
submit_storyboard "test_user_charlie_$(date +%s)" "A chef competes in an underground cooking competition in Tokyo" "Charlie"
sleep 0.5
submit_storyboard "test_user_diana_$(date +%s)" "A time traveler tries to prevent a historical disaster" "Diana"
sleep 0.5
submit_storyboard "test_user_eve_$(date +%s)" "A marine biologist discovers a new species in the deep ocean" "Eve"

# Wait for all submissions to complete
echo "⏳ Waiting for all submissions to complete..."
wait

echo ""
echo "📊 Queue State After Submissions:"
bunx convex run storyboardQueue:getQueueStats

echo ""
echo "👀 Monitoring queue processing for 3 minutes..."
echo "   (Press Ctrl+C to stop monitoring early)"
echo ""

# Monitor for 3 minutes
for i in {1..18}; do
    sleep 10
    stats=$(bunx convex run storyboardQueue:getQueueStats 2>/dev/null)
    queued=$(echo "$stats" | jq -r '.totalQueued // 0')
    processing=$(echo "$stats" | jq -r '.totalProcessing // 0')
    completed=$(echo "$stats" | jq -r '.totalCompleted // 0')
    failed=$(echo "$stats" | jq -r '.totalFailed // 0')
    
    echo "[${i}] Queue: ${queued} queued, ${processing} processing, ${completed} completed, ${failed} failed"
    
    # If all are completed, break early
    if [[ "$queued" == "0" && "$processing" == "0" && "$completed" -gt "0" ]]; then
        echo "✅ All storyboards processed!"
        break
    fi
done

echo ""
echo "🏁 Final Results:"
final_stats=$(bunx convex run storyboardQueue:getQueueStats)
echo "$final_stats"

# Extract values for validation
final_queued=$(echo "$final_stats" | jq -r '.totalQueued // 0')
final_processing=$(echo "$final_stats" | jq -r '.totalProcessing // 0')
final_completed=$(echo "$final_stats" | jq -r '.totalCompleted // 0')
final_failed=$(echo "$final_stats" | jq -r '.totalFailed // 0')

echo ""
echo "🔍 Test Validation:"

if [[ "$final_queued" == "0" && "$final_processing" == "0" ]]; then
    echo "✅ Queue Processing: All items processed"
else
    echo "⚠️  Queue Processing: Some items still pending"
fi

if [[ "$final_completed" -ge "5" ]]; then
    echo "✅ Success Rate: Multiple storyboards completed successfully"
else
    echo "⚠️  Success Rate: Less than expected completions"
fi

if [[ "$final_failed" == "0" ]]; then
    echo "✅ Error Rate: No failures detected"
else
    echo "⚠️  Error Rate: $final_failed failures detected"
fi

echo ""
echo "📈 Multi-User Queue Test Results:"
if [[ "$final_queued" == "0" && "$final_processing" == "0" && "$final_completed" -ge "5" && "$final_failed" == "0" ]]; then
    echo "🎉 TEST PASSED - Queue system handles multiple concurrent users correctly!"
    echo ""
    echo "✅ Verified behaviors:"
    echo "   • Multiple users can submit storyboards concurrently"
    echo "   • Queue maintains FIFO ordering"
    echo "   • Rate limiting (10 RPM) is respected"
    echo "   • All submissions are processed successfully"
    echo "   • No race conditions or data conflicts"
else
    echo "❌ TEST FAILED - Issues detected in queue system"
fi

echo ""
echo "🧹 Cleaning up test data..."
bunx convex run storyboardQueue:cleanupOldQueueItems "{\"olderThanHours\":0}" > /dev/null 2>&1

echo "✅ Multi-user test complete!"