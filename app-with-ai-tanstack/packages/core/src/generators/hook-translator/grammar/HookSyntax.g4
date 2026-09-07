// HookSyntax.g4
// ANTLR4 Grammar for parsing hook definitions in Mermaid flowcharts
// Syntax: %%hook <hookType> <hookName> on <EntityName>[<parameters>]

grammar HookSyntax;

// Parser Rules
hookDefinition
    : HOOK_DECL hookType HOOK_NAME ON entity=ID (LBRACKET parameters? RBRACKET)? EOF
    ;

hookType
    : BEFORE_CREATE
    | AFTER_CREATE
    | BEFORE_UPDATE
    | AFTER_UPDATE
    | BEFORE_DELETE
    | AFTER_DELETE
    | BEFORE_QUERY
    | AFTER_QUERY
    | CUSTOM_VALIDATE
    | BEFORE_READ
    | AFTER_READ
    | BEFORE_LIST
    | AFTER_LIST
    ;

parameters
    : parameter (COMMA parameter)*
    ;

parameter
    : FIELD COLON name=ID
    ;

// Lexer Rules
HOOK_DECL: '%%hook';
HOOK_NAME: ID;
ON: 'on';
LBRACKET: '[';
RBRACKET: ']';
COMMA: ',';
COLON: ':';
FIELD: 'field';

// Hook Type Keywords
BEFORE_CREATE: 'beforeCreate';
AFTER_CREATE: 'afterCreate';
BEFORE_UPDATE: 'beforeUpdate';
AFTER_UPDATE: 'afterUpdate';
BEFORE_DELETE: 'beforeDelete';
AFTER_DELETE: 'afterDelete';
BEFORE_QUERY: 'beforeQuery';
AFTER_QUERY: 'afterQuery';
CUSTOM_VALIDATE: 'customValidate';
BEFORE_READ: 'beforeRead';
AFTER_READ: 'afterRead';
BEFORE_LIST: 'beforeList';
AFTER_LIST: 'afterList';

// Identifiers and Literals
ID: [a-zA-Z_][a-zA-Z0-9_]*;

// Whitespace and Comments
WS: [ \t\r\n]+ -> skip;
LINE_COMMENT: '//' ~[\r\n]* -> skip;
COMMENT: '/*' .*? '*/' -> skip;
