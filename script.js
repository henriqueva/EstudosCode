/**
 * ENGINE DE SLOT MACHINE ORIENTADA A OBJETOS (iGaming Core)
 * 
 * Implementação purista de Engenharia de Software:
 * 1. Padrão de Projeto State (FSM) para erradicação de condicionais procedimentais.
 * 2. Princípio "Tell, Don't Ask": A View não lê dados privados via getters; ela
 *    é notificada passivamente por despachos orientados a dados (Data-Driven Payload).
 * 3. Física de carretel baseada em Interpolação Linear (LERP) para animações fluidas a 60 FPS.
 * 4. Desacoplamento arquitetural completo (Observer Pattern).
 */

// Símbolos disponíveis na Slot Machine
const SYMBOLS = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
const SYMBOL_HEIGHT = 80; // Correspondente ao CSS

/**
 * Interface/Base para os Estados da Máquina de Estados (FSM)
 */
class SlotState {
    spin(game) {
        throw new Error("Método spin() não implementado para este estado.");
    }
    update(game, dt) {
        // Por padrão, estados estáticos não precisam de updates contínuos
    }
}

/**
 * Estado ocioso: Pronto para um novo giro.
 */
class IdleState extends SlotState {
    get name() { return "IDLE"; }
    spin(game) {
        if (game.canSpin()) {
            game.transitionTo(new SpinningState());
            game.executeSpin();
        } else {
            game.notifyNoCredits();
        }
    }
}

/**
 * Estado de Giro (Spinning): Os carretéis estão rodando.
 * Bloqueia chamadas adicionais de spin.
 */
class SpinningState extends SlotState {
    get name() { return "SPINNING"; }
    spin(game) {
        // Bloqueado: Não executa comando durante o spin (Tell, Don't Ask)
    }

    update(game, dt) {
        let allStopped = true;
        const reels = game.getReelsInternal();

        for (let i = 0; i < reels.length; i++) {
            const reel = reels[i];
            
            // LERP: interpolação linear suave para desaceleração
            const diff = reel.targetY - reel.currentY;
            if (Math.abs(diff) > 0.1) {
                reel.currentY += diff * 0.08; // 0.08 é a taxa de easing (lerp multiplier)
                allStopped = false;
            } else {
                reel.currentY = reel.targetY;
            }
        }

        // Se todos os carretéis atingirem seus alvos, calcula resultado
        if (allStopped) {
            game.evaluateResult();
        }
    }
}

/**
 * Estado de Exibição do Resultado (Jackpot/Vitória/Derrota).
 */
class ResultState extends SlotState {
    get name() { return "RESULT"; }
    spin(game) {
        if (game.canSpin()) {
            game.transitionTo(new SpinningState());
            game.executeSpin();
        } else {
            game.notifyNoCredits();
        }
    }
}

/**
 * Classe principal do Modelo (Core Engine do Jogo)
 */
class SlotGame {
    constructor() {
        // Atributos privados encapsulados
        this._credits = 1000;
        this._jackpot = 50000;
        this._lastWin = 0;
        this._spinCost = 10;
        
        this._state = new IdleState();
        this._listeners = [];
        this._reels = [
            { currentY: 0, targetY: 0, symbols: [] },
            { currentY: 0, targetY: 0, symbols: [] },
            { currentY: 0, targetY: 0, symbols: [] }
        ];

        this.initializeReels();
    }

    initializeReels() {
        // Inicializa as tiras de símbolos de forma aleatória
        for (let i = 0; i < 3; i++) {
            this._reels[i].symbols = this.generateRandomStrip();
            this._reels[i].currentY = 0;
            this._reels[i].targetY = 0;
        }
    }

    generateRandomStrip() {
        // Gera uma tira vertical de 100 símbolos aleatórios para simular a rolagem infinita sem estourar limites
        const strip = [];
        for (let i = 0; i < 100; i++) {
            const randIndex = Math.floor(Math.random() * SYMBOLS.length);
            strip.push(SYMBOLS[randIndex]);
        }
        return strip;
    }

    // Subscrever ao Observer
    subscribe(listener) {
        this._listeners.push(listener);
        this.dispatchState(); // Envia o estado inicial
    }

    // Despacha o Payload orientado a dados (Data-Driven Payload) à View
    dispatchState(message = "Pronto para girar!", isWinning = false) {
        const payload = {
            credits: this._credits,
            jackpot: this._jackpot,
            winAmount: this._lastWin,
            isSpinning: this._state instanceof SpinningState,
            stateName: this._state.name,
            message: message,
            isWinning: isWinning,
            reels: this._reels.map(r => ({
                currentY: r.currentY,
                symbols: [...r.symbols]
            }))
        };
        
        // Notifica todos os observers inscritos
        this._listeners.forEach(callback => callback(payload));
    }

    // Ações internas e transições
    transitionTo(newState) {
        this._state = newState;
    }

    canSpin() {
        return this._credits >= this._spinCost;
    }

    // Executa a dedução do saldo e define alvos dos carretéis
    executeSpin() {
        this._credits -= this._spinCost;
        this._jackpot += 2; // Acúmulo de Jackpot progressivo
        this._lastWin = 0;

        // Para cada carretel, decide uma nova tira de símbolos e define um alvo distante
        for (let i = 0; i < 3; i++) {
            const newStrip = this.generateRandomStrip();
            
            // Símbolo vencedor aleatório (no final da tira, penúltimo elemento para visualização central)
            const targetSymbolIndex = 15 + Math.floor(Math.random() * 15); 
            
            this._reels[i].symbols = newStrip;
            this._reels[i].currentY = 0;
            
            // Distância do spin baseada em cascata (carretel 0 para rápido, 1 médio, 2 mais lento)
            const cascadeBonus = i * 8 * SYMBOL_HEIGHT;
            this._reels[i].targetY = - (targetSymbolIndex * SYMBOL_HEIGHT) - cascadeBonus;
        }

        this.dispatchState("Girando...", false);
    }

    // Acessador para loop interno
    getReelsInternal() {
        return this._reels;
    }

    notifyNoCredits() {
        // Recarga de créditos automática por cortesia do cassino para facilitar teste
        this._credits = 500;
        this.dispatchState("Saldo zerado! Cassino recarregou 500 créditos como bônus.", false);
    }

    // Loop de update
    update(dt) {
        this._state.update(this, dt);
        // Atualiza a View de forma contínua durante a animação
        if (this._state instanceof SpinningState) {
            this.dispatchState("Girando...", false);
        }
    }

    // Avaliação matemática dos resultados
    evaluateResult() {
        // Identifica os símbolos que pararam no viewport (índice calculado a partir da posição alvo)
        const finalSymbols = this._reels.map(r => {
            const index = Math.round(Math.abs(r.targetY) / SYMBOL_HEIGHT);
            return r.symbols[index];
        });

        const [s1, s2, s3] = finalSymbols;
        let win = 0;
        let msg = "Não foi dessa vez. Tente de novo!";
        let isWinning = false;

        // Regras de negócio puristas de iGaming
        if (s1 === s2 && s2 === s3) {
            isWinning = true;
            if (s1 === '💎') {
                win = this._jackpot;
                this._jackpot = 50000; // Reseta o Jackpot
                msg = `🎉 JACKPOT PROGRESSIVO ACUMULADO! Ganhou ${win} créditos! 💎`;
            } else if (s1 === '7️⃣') {
                win = 500;
                msg = `🔥 Super Sete! Ganhou ${win} créditos! 🔥`;
            } else if (s1 === '🔔') {
                win = 200;
                msg = `🔔 Sinos da Sorte! Ganhou ${win} créditos! 🔔`;
            } else if (s1 === '🍋') {
                win = 100;
                msg = `🍋 Trio de Limões! Ganhou ${win} créditos! 🍋`;
            } else {
                win = 50;
                msg = `🍒 Trio de Cerejas! Ganhou ${win} créditos! 🍒`;
            }
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
            // Par simples (vitória menor)
            win = 10;
            isWinning = true;
            msg = `Par de símbolos! Recuperou ${win} créditos.`;
        }

        this._credits += win;
        this._lastWin = win;

        this.transitionTo(new ResultState());
        this.dispatchState(msg, isWinning);
    }

    // Comando de spin externo (Tell, Don't Ask)
    spin() {
        this._state.spin(this);
    }
}

/**
 * CLASSE VIEW (Gerenciadora da Interface do Usuário - DOM)
 */
class SlotView {
    constructor(game) {
        this._game = game;

        // Cache de referências do DOM
        this._btnSpin = document.getElementById('spin-button');
        this._txtCredits = document.getElementById('credits-display');
        this._txtJackpot = document.getElementById('jackpot-display');
        this._txtWin = document.getElementById('win-display');
        this._txtMessage = document.getElementById('slot-message');
        this._strips = [
            document.getElementById('strip-0'),
            document.getElementById('strip-1'),
            document.getElementById('strip-2')
        ];
        this._nodeIdle = document.getElementById('node-idle');
        this._nodeSpinning = document.getElementById('node-spinning');
        this._nodeResult = document.getElementById('node-result');

        this.initializeEvents();
        
        // Se inscreve para atualizações baseadas em dados
        this._game.subscribe(payload => this.render(payload));
    }

    initializeEvents() {
        this._btnSpin.addEventListener('click', () => {
            this._game.spin();
        });
    }

    // Renderiza a interface estritamente com os dados recebidos do payload
    render(payload) {
        this._txtCredits.textContent = payload.credits.toLocaleString();
        this._txtJackpot.textContent = `💎 ${payload.jackpot.toLocaleString()}`;
        this._txtWin.textContent = payload.winAmount.toLocaleString();
        
        // Habilita/Desabilita o botão de spin baseado no estado da animação
        this._btnSpin.disabled = payload.isSpinning;
        
        // Atualiza o fluxograma FSM
        this._nodeIdle.classList.remove('active');
        this._nodeSpinning.classList.remove('active');
        this._nodeResult.classList.remove('active');
        
        if (payload.stateName === 'IDLE') {
            this._nodeIdle.classList.add('active');
        } else if (payload.stateName === 'SPINNING') {
            this._nodeSpinning.classList.add('active');
        } else if (payload.stateName === 'RESULT') {
            this._nodeResult.classList.add('active');
        }
        
        // Mensagem de Status com manipulação dinâmica de classes
        this._txtMessage.textContent = payload.message;
        
        if (payload.isWinning) {
            this._txtMessage.className = 'slot-status-message win';
        } else if (payload.isSpinning) {
            this._txtMessage.className = 'slot-status-message spin';
        } else {
            this._txtMessage.className = 'slot-status-message';
        }

        // Renderização física dos carretéis
        for (let i = 0; i < 3; i++) {
            const stripEl = this._strips[i];
            const reelData = payload.reels[i];
            
            // Reconstrói o HTML dos símbolos do carretel apenas se necessário ou na primeira carga
            if (stripEl.children.length !== reelData.symbols.length) {
                stripEl.innerHTML = reelData.symbols
                    .map(sym => `<div class="reel-symbol">${sym}</div>`)
                    .join('');
            }

            // Aplica translação vertical física (LERP calculada pelo loop da engine)
            stripEl.style.transform = `translateY(${reelData.currentY}px)`;

            // Aplica filtro de desfoque de movimento enquanto está girando
            const symbolsList = stripEl.querySelectorAll('.reel-symbol');
            symbolsList.forEach(symbolEl => {
                if (payload.isSpinning) {
                    symbolEl.classList.add('blur');
                } else {
                    symbolEl.classList.remove('blur');
                }
            });
        }
    }
}

// INICIALIZAÇÃO E LOOP DE FRAME RATE DO JOGO
document.addEventListener('DOMContentLoaded', () => {
    const game = new SlotGame();
    new SlotView(game);

    let lastTime = performance.now();

    // Loop de animação de alta performance (60 FPS)
    function gameLoop(currentTime) {
        const dt = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        game.update(dt);

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
});
