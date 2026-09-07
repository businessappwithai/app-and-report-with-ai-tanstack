lexer grammar SQLLexer;

// Whitespace
WS: [ \t\n\r]+ -> skip;

// Comments
COMMENT: ('--' ~[\r\n]* | '/*' .*? '*/') -> skip;

// Keywords - ALLOWED (safe)
SELECT: 'SELECT' | 'select';
FROM: 'FROM' | 'from';
WHERE: 'WHERE' | 'where';
AND: 'AND' | 'and';
OR: 'OR' | 'or';
NOT: 'NOT' | 'not';
JOIN: 'JOIN' | 'join';
INNER: 'INNER' | 'inner';
LEFT: 'LEFT' | 'left';
RIGHT: 'RIGHT' | 'right';
FULL: 'FULL' | 'full';
OUTER: 'OUTER' | 'outer';
ON: 'ON' | 'on';
AS: 'AS' | 'as';
IN: 'IN' | 'in';
LIKE: 'LIKE' | 'like';
ILIKE: 'ILIKE' | 'ilike';
BETWEEN: 'BETWEEN' | 'between';
IS: 'IS' | 'is';
NULL: 'NULL' | 'null';
DISTINCT: 'DISTINCT' | 'distinct';
GROUP: 'GROUP' | 'group';
BY: 'BY' | 'by';
HAVING: 'HAVING' | 'having';
ORDER: 'ORDER' | 'order';
ASC: 'ASC' | 'asc';
DESC: 'DESC' | 'desc';
LIMIT: 'LIMIT' | 'limit';
OFFSET: 'OFFSET' | 'offset';
FETCH: 'FETCH' | 'fetch';
ROWS: 'ROWS' | 'rows';
NEXT: 'NEXT' | 'next';
ONLY: 'ONLY' | 'only';
WITH: 'WITH' | 'with';
UNION: 'UNION' | 'union';
INTERSECT: 'INTERSECT' | 'intersect';
EXCEPT: 'EXCEPT' | 'except';
CASE: 'CASE' | 'case';
WHEN: 'WHEN' | 'when';
THEN: 'THEN' | 'then';
ELSE: 'ELSE' | 'else';
END: 'END' | 'end';
CAST: 'CAST' | 'cast';
OVER: 'OVER' | 'over';
PARTITION: 'PARTITION' | 'partition';
WINDOW: 'WINDOW' | 'window';
ROW: 'ROW' | 'row';
RECURSIVE: 'RECURSIVE' | 'recursive';
ALL: 'ALL' | 'all';
ANY: 'ANY' | 'any';
EXISTS: 'EXISTS' | 'exists';
TRUE: 'TRUE' | 'true';
FALSE: 'FALSE' | 'false';

// Aggregate functions (ALLOWED)
COUNT: 'COUNT' | 'count';
SUM: 'SUM' | 'sum';
AVG: 'AVG' | 'avg';
MIN: 'MIN' | 'min';
MAX: 'MAX' | 'max';
STDDEV: 'STDDEV' | 'stddev';
VARIANCE: 'VARIANCE' | 'variance';

// Date/time functions (ALLOWED)
EXTRACT: 'EXTRACT' | 'extract';
DATE_TRUNC: 'DATE_TRUNC' | 'date_trunc';
NOW: 'NOW' | 'now';
CURRENT_DATE: 'CURRENT_DATE' | 'current_date';
CURRENT_TIME: 'CURRENT_TIME' | 'current_time';
CURRENT_TIMESTAMP: 'CURRENT_TIMESTAMP' | 'current_timestamp';

// String functions (ALLOWED)
SUBSTRING: 'SUBSTRING' | 'substring';
LENGTH: 'LENGTH' | 'length';
UPPER: 'UPPER' | 'upper';
LOWER: 'LOWER' | 'lower';
TRIM: 'TRIM' | 'trim';
LTRIM: 'LTRIM' | 'ltrim';
RTRIM: 'RTRIM' | 'rtrim';
CONCAT: 'CONCAT' | 'concat';
COALESCE: 'COALESCE' | 'coalesce';
NULLIF: 'NULLIF' | 'nullif';
ROUND: 'ROUND' | 'round';
FLOOR: 'FLOOR' | 'floor';
CEIL: 'CEIL' | 'ceil';
ABS: 'ABS' | 'abs';

// FORBIDDEN Keywords
DROP: 'DROP' | 'drop';
DELETE: 'DELETE' | 'delete';
INSERT: 'INSERT' | 'insert';
UPDATE: 'UPDATE' | 'update';
CREATE: 'CREATE' | 'create';
ALTER: 'ALTER' | 'alter';
TRUNCATE: 'TRUNCATE' | 'truncate';
PRAGMA: 'PRAGMA' | 'pragma';
ATTACH: 'ATTACH' | 'attach';
DETACH: 'DETACH' | 'detach';
GRANT: 'GRANT' | 'grant';
REVOKE: 'REVOKE' | 'revoke';
EXEC: 'EXEC' | 'exec';
EXECUTE: 'EXECUTE' | 'execute';
CALL: 'CALL' | 'call';
INTO: 'INTO' | 'into';
VALUES: 'VALUES' | 'values';
SET: 'SET' | 'set';
REPLACE: 'REPLACE' | 'replace';
UPSERT: 'UPSERT' | 'upsert';

// Operators
STAR: '*';
COMMA: ',';
DOT: '.';
LPAREN: '(';
RPAREN: ')';
EQ: '=' | '==';
NEQ: '!=' | '<>' | '~=';
LT: '<';
GT: '>';
LTE: '<=' | '=<';
GTE: '>=' | '=>';
PLUS: '+';
MINUS: '-';
SLASH: '/';
PERCENT: '%';
COLON: ':';
SEMICOLON: ';';
QUESTION: '?';
CARET: '^';
PIPE: '|';
AMPERSAND: '&';
TILDE: '~';
CONCAT_OP: '||';

// Literals
STRING: '\'' ( ~'\'' | '\'\'' )* '\'';
IDENTIFIER: [a-zA-Z_] [a-zA-Z0-9_$]*;
NUMBER: [0-9]+ ('.' [0-9]+)?;
UNKNOWN_KEYWORD: [a-zA-Z] [a-zA-Z0-9_]*;
