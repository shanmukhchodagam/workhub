import os
from typing import TypedDict, Annotated, List, Dict, Any
from langgraph.graph import StateGraph, END
import operator
import json
import re
from datetime import datetime
import asyncio
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    from langchain_groq import ChatGroq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    print("Groq not available, using fallback")

class WorkerMessageState(TypedDict):
    """State for processing worker messages"""
    messages: Annotated[List[str], operator.add]
    raw_message: str
    sender_id: int
    intent: str
    confidence: float
    entities: Dict[str, Any]
    database_action: str
    response_message: str
    requires_manager_attention: bool
    timestamp: str

# Intent patterns for quick classification
INTENT_PATTERNS = {
    "task_update": [
        r"(completed|finished|done|complete).*(task|work|job)",
        r"(task|work|job).*(completed|finished|done|complete)",
        r"(started|beginning|begin).*(task|work|job)",
        r"(task|work|job).*(started|beginning|begin)", 
        r"(progress|update|status).*(task|work|job)",
        r"(task|work|job).*(progress|update|status)",
        r"(need|require|want).*(material|tool|equipment)",
        r"(delayed|behind|late|slow)",
        r"(on schedule|on time|ahead)"
    ],
    "incident_report": [
        r"(incident|accident|emergency|problem|issue)",
        r"(safety|danger|hazard|risk)",
        r"(broken|damaged|malfunction|fault)",
        r"(injury|hurt|injured|medical)",
        r"(leak|spill|fire|gas)",
        r"(urgent|emergency|critical|serious)"
    ],
    "permission_request": [
        r"(permission|access|authorize|approval)",
        r"(overtime|extra hours|weekend|holiday)",
        r"(restricted|locked|secure|private)",
        r"(can i|may i|allowed to|permit)",
        r"(approve|authorization|clearance)"
    ],
    "attendance": [
        r"(check in|arrived|here|present)",
        r"(check out|leaving|finished|going home)",
        r"(break|lunch|rest)",
        r"(sick|ill|absent|leave)",
        r"(on site|at location|reached)"
    ],
    "question": [
        r"(how|what|when|where|why|help)",
        r"(instruction|procedure|guideline)",
        r"(don't know|not sure|confused|unclear)",
        r"(explain|clarify|understand)"
    ]
}

def classify_intent_rule_based(message: str) -> tuple[str, float]:
    """Rule-based intent classification for speed and reliability"""
    message_lower = message.lower()
    
    intent_scores = {}
    
    for intent, patterns in INTENT_PATTERNS.items():
        score = 0
        for pattern in patterns:
            if re.search(pattern, message_lower):
                score += 1
        
        if score > 0:
            intent_scores[intent] = score / len(patterns)
    
    if not intent_scores:
        return "general", 0.5
    
    best_intent = max(intent_scores, key=intent_scores.get)
    confidence = intent_scores[best_intent]
    
    return best_intent, confidence

def extract_entities(message: str, intent: str) -> Dict[str, Any]:
    """Extract relevant entities from the message"""
    entities = {}
    message_lower = message.lower()
    
    # Extract time mentions
    time_patterns = [
        r"(\d{1,2}:\d{2})",  # 14:30
        r"(morning|afternoon|evening|night)",
        r"(today|tomorrow|yesterday)",
        r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)"
    ]
    
    for pattern in time_patterns:
        matches = re.findall(pattern, message_lower)
        if matches:
            entities["time_mentions"] = matches
    
    # Extract location mentions
    location_patterns = [
        r"(building|floor|room|site|area|zone)\s*([a-z0-9]+)",
        r"(basement|roof|office|warehouse|factory)"
    ]
    
    for pattern in location_patterns:
        matches = re.findall(pattern, message_lower)
        if matches:
            entities["locations"] = [f"{match[0]} {match[1]}" if len(match) > 1 else match[0] for match in matches]
    
    # Extract equipment mentions
    equipment_patterns = [
        r"(generator|pump|valve|motor|machine|equipment|tool)",
        r"(electrical|plumbing|hvac|mechanical)"
    ]
    
    for pattern in equipment_patterns:
        matches = re.findall(pattern, message_lower)
        if matches:
            entities["equipment"] = matches
    
    # Extract urgency indicators
    urgency_patterns = [
        r"(urgent|emergency|asap|immediately|critical)",
        r"(low priority|when possible|no rush)"
    ]
    
    for pattern in urgency_patterns:
        matches = re.findall(pattern, message_lower)
        if matches:
            entities["urgency"] = matches
    
    return entities

async def llm_classify_intent(message: str) -> tuple[str, float]:
    """Fallback LLM classification for complex cases"""
    if not GROQ_AVAILABLE or not os.getenv("GROQ_API_KEY"):
        return "general", 0.3
    
    try:
        llm = ChatGroq(
            temperature=0.1,
            model_name="llama-3.3-70b-versatile",  # Latest Llama model 
            api_key=os.getenv("GROQ_API_KEY")
        )
        
        prompt = f"""
        Classify this worker message into one of these categories:
        - task_update: Work progress, completion, or status updates
        - incident_report: Safety issues, accidents, problems, emergencies  
        - permission_request: Requests for access, approval, or authorization
        - attendance: Check-in/out, breaks, location updates
        - question: Asking for help, instructions, or clarification
        - general: Everything else
        
        Message: "{message}"
        
        Respond with just: INTENT|CONFIDENCE
        Example: task_update|0.9
        """
        
        response = await llm.ainvoke(prompt)
        result = response.content.strip().split('|')
        
        if len(result) == 2:
            intent = result[0].strip()
            confidence = float(result[1].strip())
            return intent, confidence
        
    except Exception as e:
        print(f"LLM classification failed: {e}")
    
    return "general", 0.3

async def intent_classifier(state: WorkerMessageState) -> Dict:
    """Advanced intent classification with multiple strategies"""
    message = state["raw_message"]
    
    # First try rule-based (fast and free)
    rule_intent, rule_confidence = classify_intent_rule_based(message)
    
    # Use rule-based if confidence is high enough
    if rule_confidence > 0.7:
        return {
            "intent": rule_intent,
            "confidence": rule_confidence,
            "entities": extract_entities(message, rule_intent)
        }
    
    # For low confidence, try LLM classification
    print(f"🤖 Rule-based confidence too low ({rule_confidence:.2f}), trying LLM...")
    llm_intent, llm_confidence = await llm_classify_intent(message)
    
    # Use LLM result if it has higher confidence
    if llm_confidence > rule_confidence:
        print(f"✅ Using LLM result: {llm_intent} (confidence: {llm_confidence:.2f})")
        final_intent = llm_intent
        final_confidence = llm_confidence
    else:
        print(f"⚡ Sticking with rule-based: {rule_intent} (confidence: {rule_confidence:.2f})")
        final_intent = rule_intent
        final_confidence = rule_confidence
    
    return {
        "intent": final_intent,
        "confidence": final_confidence,
        "entities": extract_entities(message, final_intent)
    }

def database_router(state: WorkerMessageState) -> Dict:
    """Route to appropriate database action based on intent"""
    intent = state["intent"]
    confidence = state["confidence"]
    entities = state["entities"]
    
    # Only auto-process if confidence is high enough
    auto_process = confidence > 0.6
    
    database_actions = {
        "task_update": "update_task_progress",
        "incident_report": "create_incident_record", 
        "permission_request": "create_permission_request",
        "attendance": "update_attendance_record",
        "question": "route_to_support",
        "general": "log_general_message"
    }
    
    action = database_actions.get(intent, "log_general_message")
    
    # Determine if manager attention is needed
    manager_attention = (
        intent in ["incident_report", "permission_request"] or 
        confidence < 0.5 or
        "urgent" in str(entities.get("urgency", "")).lower()
    )
    
    return {
        "database_action": action,
        "requires_manager_attention": manager_attention
    }

async def generate_llm_response(message: str, intent: str, confidence: float, entities: Dict) -> str:
    """Generate contextual response using Groq LLM"""
    if not GROQ_AVAILABLE or not os.getenv("GROQ_API_KEY"):
        # Fallback to basic responses
        responses = {
            "task_update": "✅ Task update noted!",
            "incident_report": "🚨 Incident reported - manager notified!",
            "permission_request": "📋 Permission request forwarded!",
            "attendance": "⏰ Attendance recorded!",
            "question": "❓ Question noted - getting help!",
            "general": "📝 Message received!"
        }
        return responses.get(intent, "Message received!")
    
    try:
        llm = ChatGroq(
            temperature=0.3,  # Slightly more creative for responses
            model_name="llama-3.3-70b-versatile",
            api_key=os.getenv("GROQ_API_KEY")
        )
        
        # Create context-aware prompt
        urgency = entities.get("urgency", [])
        time_mentions = entities.get("time_mentions", [])
        equipment = entities.get("equipment", [])
        
        context = f"""
        Original worker message: "{message}"
        Classified as: {intent} (confidence: {confidence:.2f})
        Detected entities: urgency={urgency}, time={time_mentions}, equipment={equipment}
        
        Generate a helpful, professional response as WorkHub AI Assistant. Be:
        - Specific to their message content
        - Acknowledge what action you're taking
        - Friendly but professional
        - Concise (1-2 sentences max)
        
        Response for {intent}:"""
        
        response = await llm.ainvoke(context)
        return response.content.strip()
        
    except Exception as e:
        print(f"LLM response generation failed: {e}")
        return f"📝 Got your message about {intent.replace('_', ' ')}. Taking appropriate action!"

async def response_generator(state: WorkerMessageState) -> Dict:
    """Generate appropriate response to worker using LLM"""
    intent = state["intent"]
    confidence = state["confidence"]
    message = state["raw_message"]
    entities = state["entities"]
    
    # Generate contextual response using LLM
    print(f"🤖 Generating LLM response for: {intent}")
    llm_response = await generate_llm_response(message, intent, confidence, entities)
    
    # Add confidence indicator for low confidence
    if confidence < 0.5:
        llm_response += "\n\n(I'm not 100% sure what you meant, so I've flagged this for manager review)"
    
    return {
        "response_message": llm_response,
        "timestamp": datetime.now().isoformat()
    }

# Create the workflow
def create_agent_workflow():
    """Create the LangGraph workflow for processing worker messages"""
    workflow = StateGraph(WorkerMessageState)
    
    # Add nodes
    workflow.add_node("classify_intent", intent_classifier)
    workflow.add_node("route_database", database_router)  
    workflow.add_node("generate_response", response_generator)
    
    # Set entry point
    workflow.set_entry_point("classify_intent")
    
    # Add edges
    workflow.add_edge("classify_intent", "route_database")
    workflow.add_edge("route_database", "generate_response") 
    workflow.add_edge("generate_response", END)
    
    return workflow.compile()

# Create the compiled workflow
agent_app = create_agent_workflow()

async def process_worker_message(message: str, sender_id: int) -> Dict:
    """Main function to process worker messages"""
    initial_state = WorkerMessageState(
        messages=[],
        raw_message=message,
        sender_id=sender_id,
        intent="",
        confidence=0.0,
        entities={},
        database_action="",
        response_message="",
        requires_manager_attention=False,
        timestamp=""
    )
    
    result = await agent_app.ainvoke(initial_state)
    return result

# Test function 
def test_agent():
    """Test the agent with sample messages"""
    test_messages = [
        "Just finished the plumbing repair in Building A",
        "There's a gas leak in the basement - urgent!",
        "Can I get approval for overtime this weekend?", 
        "Checked in at the construction site",
        "How do I operate this new equipment?"
    ]
    
    print("🤖 Testing WorkHub Agent...")
    for msg in test_messages:
        print(f"\n📨 Message: {msg}")
        
        # Simulate processing
        intent, confidence = classify_intent_rule_based(msg)
        entities = extract_entities(msg, intent)
        
        print(f"🎯 Intent: {intent} (confidence: {confidence:.2f})")
        print(f"📋 Entities: {entities}")
        print("-" * 50)

if __name__ == "__main__":
    test_agent()
