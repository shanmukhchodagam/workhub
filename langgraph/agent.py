from typing import TypedDict, Annotated, List, Union
from langgraph.graph import StateGraph, END
import operator
import random

class AgentState(TypedDict):
    messages: Annotated[List[str], operator.add]
    intent: str
    sender_id: int

def detect_intent(state: AgentState):
    last_message = state["messages"][-1].lower()
    if "check in" in last_message or "attendance" in last_message:
        return {"intent": "attendance"}
    elif "incident" in last_message or "accident" in last_message or "report" in last_message:
        return {"intent": "incident"}
    elif "task" in last_message or "update" in last_message:
        return {"intent": "task_update"}
    else:
        return {"intent": "unknown"}

def execute_workflow(state: AgentState):
    intent = state["intent"]
    response = ""
    if intent == "attendance":
        response = "Attendance checked in successfully."
        # In real impl, call backend API to record attendance
    elif intent == "incident":
        response = "Incident report initiated. Please upload a photo or provide details."
    elif intent == "task_update":
        response = "Task update received."
    else:
        response = "I'm not sure what you mean. You can say 'Check in', 'Report incident', or 'Update task'."
    
    return {"messages": [response]}

workflow = StateGraph(AgentState)

workflow.add_node("detect_intent", detect_intent)
workflow.add_node("execute_workflow", execute_workflow)

workflow.set_entry_point("detect_intent")
workflow.add_edge("detect_intent", "execute_workflow")
workflow.add_edge("execute_workflow", END)

app = workflow.compile()
