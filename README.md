# 🌆 LoopWalk AI

**Goal-Based Walking Intelligence for Urban Environments**

LoopWalk AI is a prototype system that reimagines how people navigate cities on foot.  
Instead of optimizing only for the fastest route, LoopWalk AI helps users choose routes based on their intentions — such as comfort, safety, or discovery.

The project explores how agent-driven decision systems can improve everyday urban experiences and make city navigation more human-centered.

---

## 🚶 Problem

Walking in dense city environments like the Chicago Loop is not just about distance.

People face friction such as:

- Overcrowded sidewalks during rush hours  
- Unsafe-feeling routes at night  
- Heat exposure and environmental discomfort  
- Construction disruptions  
- Difficulty discovering local businesses along the way  

Existing navigation tools treat walking as a slower version of driving and optimize purely for speed.

LoopWalk AI aims to change that.

---

## 💡 Solution

LoopWalk AI introduces an intelligent routing assistant that selects walking routes based on a user's goal, not just distance.

Users can choose a destination and a walking preference, and the system:

1. Interprets the user’s intention  
2. Evaluates contextual signals about city streets  
3. Chooses a route aligned with the user’s goal  
4. Explains the reasoning behind that choice  

The result is a navigation experience that adapts to how users want to feel while walking, not just how fast they want to arrive.

---

## 🧠 How It Works (Conceptually)

LoopWalk AI operates as a layered system:

### Agent Layer
Understands the user’s intention, evaluates tradeoffs, and decides how routes should be prioritized.

### Backend Layer
Processes map data, street scores, and routing logic to generate route options.

### Frontend Layer
Visualizes routes, overlays contextual signals, and explains the AI’s reasoning to the user.

This structure allows the system to be modular, interpretable, and adaptable.

---

## 📂 Repository Structure
```text
LoopWalk/
│
├── loopwalk-ai/                     # 🧠 Agentic AI layer (LangChain / LangGraph)
│   ├── __init__.py
│   ├── config.py               # prompts, weights, constants
│   │
│   ├── graph/                  # LangGraph workflow
│   │   ├── graph.py            # graph definition
│   │   ├── nodes.py            # agent nodes (intent, scoring, explanation)
│   │   └── state.py            # shared state schema
│   │
│   ├── tools/                  # tools the agent can call
│   │   ├── route_scorer.py
│   │   ├── signal_loader.py
│   │   └── explanation.py
│   │
│   ├── prompts/                # prompt templates
│   │   ├── intent_prompt.txt
│   │   ├── weighting_prompt.txt
│   │   └── explanation_prompt.txt
│   │
│   └── runner.py               # entry point to call the agent
│
│
├── backend/                    # ⚙️ API layer
│   ├── __init__.py
│   ├── main.py                 # FastAPI / Flask app entry
│   │
│   ├── api/
│   │   ├── routes.py           # /route, /signals, /health
│   │   └── schemas.py          # request/response models
│   │
│   ├── services/
│   │   ├── routing_engine.py   # weighted path scoring logic
│   │   ├── map_data_loader.py  # mock street data
│   │   └── agent_service.py    # wrapper calling agent.runner
│   │
│   └── utils/
│       └── logger.py
│
│
├── frontend/                   # 🌐 UI layer (can be plain JS, React, etc.)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   │
│   ├── components/
│   │   ├── map.js
│   │   ├── routeToggle.js
│   │   └── explanationPanel.js
│   │
│   └── assets/
│       └── icons/
│
│
├── data/                       # 📊 mock datasets
│   ├── streets.json
│   ├── safety_scores.json
│   └── crowd_scores.json
│
│
├── scripts/                    # 🧪 helper scripts
│   ├── seed_data.py
│   └── test_agent.py
│
│
├── tests/
│   ├── test_agent.py
│   ├── test_routing.py
│   └── test_api.py
│
│
├── requirements.txt
├── README.md
└── .env
```


---

## 🚀 Project Goals

- Demonstrate how agent-driven systems can improve urban navigation
- Show that walking routes can be optimized for experience, not just speed
- Provide explainable route decisions that users can trust
- Explore how city data can be translated into everyday guidance
- Build a visually clear prototype that communicates the concept effectively

---

## 🏙 Vision

LoopWalk AI treats the city not as a static grid of streets, but as a living environment shaped by context, comfort, and human experience.

By turning city signals into intelligent decisions, the project explores how navigation systems could evolve to better support everyday urban life.

---

## ⚡ Status

This project is an early prototype designed for rapid development and demonstration.  
It focuses on clarity of concept, explainability, and visual communication rather than production-level accuracy.

---